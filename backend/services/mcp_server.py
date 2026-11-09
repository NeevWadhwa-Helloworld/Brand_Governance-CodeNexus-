from collections import deque
from math import ceil
from threading import Lock
from time import monotonic
from typing import Any

from fastapi import HTTPException
from mcp.server import MCPServer
from mcp.server.mcpserver import Context
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from backend.config import settings
from backend.database import get_db
from backend.dependencies import get_user_from_access_token
from backend.services.audit_service import AuditService
from backend.services.rag_service import RAGService


class BrandRule(BaseModel):
    rule_id: str
    category: str
    title: str
    text: str
    details: str | None


class BrandRulesResponse(BaseModel):
    rules: list[BrandRule]


class DraftFinding(BaseModel):
    id: str | None = None
    rule_id: str
    category: str
    span: str
    start_time: float | None
    end_time: float | None
    frame_number: int | None
    explanation: str
    fix: str
    confidence: float
    resolution: str


class DraftFindingsResponse(BaseModel):
    draft_id: str
    title: str
    revision_id: str | None
    version_num: int | None
    policy_coverage_status: str | None
    policy_coverage_reason: str | None
    findings: list[DraftFinding]


class DraftSummary(BaseModel):
    draft_id: str
    title: str
    content_type: str
    current_version: int
    status: str
    author_name: str | None
    updated_at: str


class DraftListResponse(BaseModel):
    drafts: list[DraftSummary]


class UserRequestLimiter:
    def __init__(self, requests_per_minute: int):
        if requests_per_minute < 1:
            raise RuntimeError("MCP_REQUESTS_PER_MINUTE must be a positive integer.")
        self.requests_per_minute = requests_per_minute
        self._requests: dict[str, deque[float]] = {}
        self._lock = Lock()

    def retry_after(self, user_id: str) -> int | None:
        now = monotonic()
        cutoff = now - 60
        with self._lock:
            requests = self._requests.setdefault(user_id, deque())
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= self.requests_per_minute:
                return max(1, ceil(60 - (now - requests[0])))
            requests.append(now)
            return None


_request_limiter = UserRequestLimiter(settings.MCP_REQUESTS_PER_MINUTE)


class MCPBearerAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            user = await run_in_threadpool(get_user_from_access_token, token.strip())
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": str(exc.detail)},
                headers={"WWW-Authenticate": "Bearer"} if exc.status_code == 401 else None,
            )
        retry_after = _request_limiter.retry_after(user["id"])
        if retry_after is not None:
            return JSONResponse(
                status_code=429,
                content={"detail": "MCP request rate limit exceeded"},
                headers={"Retry-After": str(retry_after)},
            )
        return await call_next(request)


server = MCPServer(
    "Inkloom AI",
    instructions=(
        "Read-only tools for retrieving active brand rules, listing draft metadata, "
        "and retrieving existing scan findings. Access is limited to the "
        "authenticated user's organization. These tools cannot create or change "
        "content, trigger scans, approve drafts, or publish content."
    ),
)


def _authenticated_user(ctx: Context) -> dict[str, Any]:
    authorization = (ctx.headers or {}).get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ToolError("Authentication required. Provide a valid bearer access token.")
    try:
        return get_user_from_access_token(token.strip())
    except HTTPException as exc:
        raise ToolError(str(exc.detail)) from exc


def _require_governance_role(user: dict[str, Any]) -> None:
    if user.get("role") not in {"creator", "reviewer", "admin"}:
        raise ToolError("This account is not permitted to use brand-governance tools.")


def _validate_draft_id(draft_id: str) -> str:
    value = draft_id.strip()
    if not value or len(value) > 128:
        raise ToolError("draft_id must contain 1 to 128 characters.")
    return value


def _load_draft_findings(cursor, revision_id: str | None) -> list[dict[str, Any]]:
    if not revision_id:
        return []
    cursor.execute(
        """
        SELECT id, rule_id, category, span, start_time, end_time, frame_number,
               explanation, fix, confidence, resolution
        FROM flags
        WHERE revision_id = ?
        ORDER BY category ASC, rule_id ASC, id ASC
        LIMIT 200
        """,
        (revision_id,),
    )
    return cursor.fetchall()


@server.tool()
def list_drafts(
    ctx: Context,
    status: str | None = None,
    limit: int = 20,
) -> DraftListResponse:
    """List recent drafts in the authenticated user's organization."""
    user = _authenticated_user(ctx)
    _require_governance_role(user)
    if status is not None and status not in {
        "Submitted",
        "Scanned",
        "In Revision",
        "Pending Approval",
        "Approved",
        "Changes Requested",
    }:
        raise ToolError("status is not a recognized draft status.")
    if limit < 1 or limit > 50:
        raise ToolError("limit must be between 1 and 50.")

    with get_db() as conn:
        cursor = conn.cursor()
        query = """
            SELECT d.id, d.title, d.content_type, d.current_version, d.status,
                   d.updated_at, u.name AS author_name
            FROM drafts d
            LEFT JOIN users u ON d.author_id = u.id
            WHERE d.org_id = ?
        """
        params: list[Any] = [user["org_id"]]
        if status is not None:
            query += " AND d.status = ?"
            params.append(status)
        query += " ORDER BY d.updated_at DESC, d.id ASC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        drafts = cursor.fetchall()

    result = DraftListResponse(
        drafts=[
            DraftSummary(
                draft_id=draft["id"],
                title=draft["title"],
                content_type=draft["content_type"],
                current_version=draft["current_version"],
                status=draft["status"],
                author_name=draft.get("author_name"),
                updated_at=draft["updated_at"],
            )
            for draft in drafts
        ]
    )
    AuditService.log(
        user["org_id"],
        user["id"],
        "mcp_tool_called",
        {"tool": "list_drafts", "result_count": len(result.drafts), "status": status},
    )
    return result


@server.tool()
def get_brand_rules(ctx: Context, query: str, limit: int = 8) -> BrandRulesResponse:
    """Retrieve relevant active brand rules for the authenticated user's organization."""
    user = _authenticated_user(ctx)
    _require_governance_role(user)
    if not query.strip() or len(query) > 2000:
        raise ToolError("query must contain 1 to 2000 characters.")
    if limit < 1 or limit > 8:
        raise ToolError("limit must be between 1 and 8.")

    rules = RAGService.retrieve_relevant_rules(user["org_id"], query.strip(), top_k=limit)
    result = [
        {
            "rule_id": rule["rule_id"],
            "category": rule["category"],
            "title": rule["title"],
            "text": rule["text"],
            "details": rule.get("details"),
        }
        for rule in rules
    ]
    AuditService.log(
        user["org_id"],
        user["id"],
        "mcp_tool_called",
        {"tool": "get_brand_rules", "result_count": len(result), "query_length": len(query)},
    )
    return BrandRulesResponse(rules=result)


@server.tool()
def get_draft_findings(ctx: Context, draft_id: str) -> DraftFindingsResponse:
    """Retrieve the latest scan findings for a draft in the authenticated user's organization."""
    user = _authenticated_user(ctx)
    _require_governance_role(user)
    draft_id = _validate_draft_id(draft_id)

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT d.id, d.title, r.id AS revision_id, r.version_num,
                   r.policy_coverage_status, r.policy_coverage_reason
            FROM drafts d
            LEFT JOIN revisions r
              ON r.id = (
                  SELECT latest.id FROM revisions latest
                  WHERE latest.draft_id = d.id
                  ORDER BY latest.version_num DESC, latest.created_at DESC, latest.id DESC
                  LIMIT 1
              )
            WHERE d.id = ? AND d.org_id = ?
            """,
            (draft_id, user["org_id"]),
        )
        draft = cursor.fetchone()
        if not draft:
            AuditService.log(
                user["org_id"],
                user["id"],
                "mcp_access_denied",
                {"tool": "get_draft_findings", "reason": "draft_not_found_or_out_of_scope"},
                draft_id=draft_id,
            )
            raise ToolError("Draft not found in the authenticated user's organization.")

        flags = _load_draft_findings(cursor, draft.get("revision_id"))

    result = {
        "draft_id": draft["id"],
        "title": draft["title"],
        "revision_id": draft.get("revision_id"),
        "version_num": draft.get("version_num"),
        "policy_coverage_status": draft.get("policy_coverage_status"),
        "policy_coverage_reason": draft.get("policy_coverage_reason"),
        "findings": [dict(flag) for flag in flags],
    }
    AuditService.log(
        user["org_id"],
        user["id"],
        "mcp_tool_called",
        {"tool": "get_draft_findings", "draft_id": draft_id, "result_count": len(flags)},
        draft_id=draft_id,
    )
    return DraftFindingsResponse(**result)


_allowed_hosts = [
    host_variant
    for host in settings.TRUSTED_HOSTS
    for host_variant in (host, f"{host}:*")
]
mcp_http_app = server.streamable_http_app(
    transport_security=TransportSecuritySettings(
        allowed_hosts=_allowed_hosts,
        allowed_origins=settings.CORS_ORIGINS,
    ),
    max_request_body_size=1024 * 1024,
)
mcp_http_app.add_middleware(MCPBearerAuthMiddleware)
