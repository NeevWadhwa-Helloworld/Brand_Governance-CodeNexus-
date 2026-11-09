from contextlib import nullcontext
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from mcp import Client
from mcp.server.mcpserver.exceptions import ToolError
from redis.exceptions import RedisError
from starlette.testclient import TestClient
from starlette.requests import Request
from starlette.responses import Response

from backend.services import mcp_server


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_mcp_requires_bearer_authentication():
    with pytest.raises(ToolError, match="Authentication required"):
        mcp_server._authenticated_user(SimpleNamespace(headers={}))


def test_mcp_rate_limit_is_per_user():
    limiter = mcp_server.UserRequestLimiter(2)
    assert limiter.retry_after("user-1") is None
    assert limiter.retry_after("user-1") is None
    assert limiter.retry_after("user-1") >= 1
    assert limiter.retry_after("user-2") is None


def test_mcp_limiter_defaults_to_process_local(monkeypatch):
    monkeypatch.setattr(mcp_server.settings, "MCP_RATE_LIMIT_REDIS_URL", "")
    limiter = mcp_server.create_request_limiter()
    assert isinstance(limiter, mcp_server.UserRequestLimiter)
    assert not isinstance(limiter, mcp_server.RedisUserRequestLimiter)


def test_mcp_redis_limiter_uses_shared_atomic_script(monkeypatch):
    class FakeRedis:
        def __init__(self):
            self.eval_args = None

        def ping(self):
            return True

        def eval(self, *args):
            self.eval_args = args
            return 1250

    client = FakeRedis()
    monkeypatch.setattr(
        mcp_server.Redis,
        "from_url",
        classmethod(lambda _cls, _url, **_kwargs: client),
    )
    monkeypatch.setattr(
        mcp_server.settings,
        "MCP_RATE_LIMIT_REDIS_URL",
        "rediss://redis.example.invalid:6379/0",
    )
    limiter = mcp_server.create_request_limiter()

    assert isinstance(limiter, mcp_server.RedisUserRequestLimiter)
    limiter.initialize()
    assert limiter.retry_after("sensitive-user-id") == 2
    script, key_count, key, window, limit, nonce = client.eval_args
    assert "ZREMRANGEBYSCORE" in script
    assert key_count == 1
    assert key.startswith("inkloom:mcp:rate-limit:")
    assert "sensitive-user-id" not in key
    assert (window, limit) == (60_000, mcp_server.settings.MCP_REQUESTS_PER_MINUTE)
    assert nonce


def test_mcp_redis_limiter_rejects_invalid_url():
    with pytest.raises(RuntimeError, match="must use redis:// or rediss://"):
        mcp_server.RedisUserRequestLimiter(3, "http://redis.example.invalid")


def test_mcp_redis_limiter_fails_closed_when_unavailable(monkeypatch):
    class FakeRedis:
        def ping(self):
            raise RedisError("offline")

        def eval(self, *_args):
            raise RedisError("offline")

    monkeypatch.setattr(
        mcp_server.Redis,
        "from_url",
        classmethod(lambda _cls, _url, **_kwargs: FakeRedis()),
    )
    limiter = mcp_server.RedisUserRequestLimiter(3, "redis://redis.example.invalid:6379/0")
    with pytest.raises(RuntimeError, match="Redis rate limiter is unavailable"):
        limiter.initialize()
    with pytest.raises(mcp_server.RateLimiterUnavailable):
        limiter.retry_after("user-1")


@pytest.mark.anyio
async def test_mcp_returns_service_unavailable_if_shared_limiter_fails(monkeypatch):
    class FailedLimiter:
        def retry_after(self, _user_id):
            raise mcp_server.RateLimiterUnavailable("offline")

    monkeypatch.setattr(mcp_server, "_request_limiter", FailedLimiter())
    monkeypatch.setattr(
        mcp_server,
        "get_user_from_access_token",
        lambda _token: {"id": "user-1", "org_id": "org-1", "role": "creator"},
    )
    request = Request({
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/mcp",
        "raw_path": b"/mcp",
        "query_string": b"",
        "headers": [(b"authorization", b"Bearer test-token")],
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
    })
    middleware = mcp_server.MCPBearerAuthMiddleware(app=None)

    response = await middleware.dispatch(request, lambda _request: Response("ok"))

    assert response.status_code == 503
    assert response.headers["x-request-id"]


@pytest.mark.anyio
async def test_mcp_middleware_applies_user_allowlist_after_jwt_auth(monkeypatch):
    class UnexpectedLimiter:
        def retry_after(self, _user_id):
            raise AssertionError("allowlisted users must be rejected before rate limiting")

    monkeypatch.setattr(mcp_server, "_request_limiter", UnexpectedLimiter())
    monkeypatch.setattr(mcp_server.settings, "MCP_ALLOWED_USER_IDS", ["approved-user"])
    monkeypatch.setattr(
        mcp_server,
        "get_user_from_access_token",
        lambda _token: {"id": "blocked-user", "org_id": "org-1", "role": "admin"},
    )
    request = Request({
        "type": "http",
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/mcp",
        "raw_path": b"/mcp",
        "query_string": b"",
        "headers": [(b"authorization", b"Bearer test-token")],
        "server": ("testserver", 80),
        "client": ("testclient", 50000),
    })
    middleware = mcp_server.MCPBearerAuthMiddleware(app=None)

    response = await middleware.dispatch(request, lambda _request: Response("ok"))

    assert response.status_code == 403
    assert response.headers["x-request-id"]


def test_mcp_authenticated_user_allowlist_keeps_jwt_auth_required(monkeypatch):
    monkeypatch.setattr(mcp_server.settings, "MCP_ALLOWED_USER_IDS", ["approved-user"])
    monkeypatch.setattr(
        mcp_server,
        "get_user_from_access_token",
        lambda token: {"id": "blocked-user", "org_id": "org-1", "role": "admin"},
    )
    with pytest.raises(ToolError, match="not enabled for MCP access"):
        mcp_server._authenticated_user(
            SimpleNamespace(headers={"authorization": "Bearer test-token"})
        )


@pytest.mark.anyio
async def test_mcp_exposes_only_read_tools():
    async with Client(mcp_server.server) as client:
        result = await client.list_tools()

    schemas = {tool.name: tool for tool in result.tools}
    assert set(schemas) == {"get_brand_rules", "list_drafts", "get_draft_findings"}
    assert all("ctx" not in tool.input_schema["properties"] for tool in schemas.values())
    assert schemas["get_brand_rules"].output_schema["properties"]["rules"]["type"] == "array"


def test_mcp_is_available_on_the_main_application(monkeypatch):
    from backend import main

    async def no_seed_data():
        return None

    def authenticate_token(token):
        if token != "test-token":
            raise HTTPException(status_code=401, detail="Invalid or expired authentication token")
        return {"id": "user-1", "org_id": "org-1", "role": "creator"}

    monkeypatch.setattr(main, "init_db", lambda: None)
    monkeypatch.setattr(main, "seed_database", no_seed_data)
    monkeypatch.setattr(mcp_server, "get_user_from_access_token", authenticate_token)
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2025-11-25",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"},
        },
    }
    request_headers = {
        "accept": "application/json, text/event-stream",
        "content-type": "application/json",
        "origin": "https://brand-governance-code-nexu.vercel.app",
    }

    with TestClient(main.app, base_url="http://localhost") as client:
        unauthenticated = client.post("/mcp", json=request, headers=request_headers)
        invalid_token = client.post(
            "/mcp",
            json=request,
            headers={**request_headers, "authorization": "Bearer expired"},
        )
        authenticated = client.post(
            "/mcp",
            json=request,
            headers={**request_headers, "authorization": "Bearer test-token"},
        )

        initialize_data = json.loads(
            next(line[6:] for line in authenticated.text.splitlines() if line.startswith("data: "))
        )
        protocol_version = initialize_data["result"]["protocolVersion"]
        session_id = authenticated.headers["mcp-session-id"]
        session_headers = {
            **authenticated.request.headers,
            "mcp-session-id": session_id,
            "mcp-protocol-version": protocol_version,
        }
        initialized = client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            headers=session_headers,
        )
        tools_list = client.post(
            "/mcp",
            json={"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            headers=session_headers,
        )
        tools_list_data = json.loads(
            next(line[6:] for line in tools_list.text.splitlines() if line.startswith("data: "))
        )
        client.delete("/mcp", headers=session_headers)

    assert unauthenticated.status_code == 401
    assert invalid_token.status_code == 401
    assert authenticated.status_code == 200
    assert unauthenticated.headers["x-request-id"]
    assert invalid_token.headers["x-request-id"]
    assert authenticated.headers["x-request-id"]
    assert authenticated.headers["x-request-id"]
    assert "mcp-session-id" in authenticated.headers["access-control-expose-headers"].lower()
    assert "x-request-id" in authenticated.headers["access-control-expose-headers"].lower()
    assert initialized.status_code == 202
    assert tools_list.status_code == 200
    assert {tool["name"] for tool in tools_list_data["result"]["tools"]} == {
        "get_brand_rules",
        "list_drafts",
        "get_draft_findings",
    }


def test_mcp_rejects_invalid_access_token(monkeypatch):
    def reject_token(_token):
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")

    monkeypatch.setattr(mcp_server, "get_user_from_access_token", reject_token)
    with pytest.raises(ToolError, match="Invalid or expired"):
        mcp_server._authenticated_user(
            SimpleNamespace(headers={"authorization": "Bearer invalid"})
        )


def test_mcp_limits_rule_query_and_audits_successful_calls(monkeypatch):
    monkeypatch.setattr(
        mcp_server, "_authenticated_user",
        lambda _ctx: {"id": "user-1", "org_id": "org-1", "role": "creator"},
    )
    retrieval_calls = []
    audit_calls = []
    monkeypatch.setattr(
        mcp_server.RAGService,
        "retrieve_relevant_rules",
        lambda org_id, query, top_k: retrieval_calls.append((org_id, query, top_k)) or [],
    )
    monkeypatch.setattr(
        mcp_server.AuditService, "log",
        lambda *args, **kwargs: audit_calls.append((args, kwargs)),
    )
    ctx = SimpleNamespace(headers={})

    with pytest.raises(ToolError, match="query must contain"):
        mcp_server.get_brand_rules(ctx, " ", 4)
    with pytest.raises(ToolError, match="limit must be"):
        mcp_server.get_brand_rules(ctx, "brand voice", 9)

    assert mcp_server.get_brand_rules(ctx, "brand voice", 4).model_dump() == {"rules": []}
    assert retrieval_calls == [("org-1", "brand voice", 4)]
    assert len(audit_calls) == 1
    assert audit_calls[0][0][2] == "mcp_tool_called"


def test_mcp_rejects_cross_organization_findings_and_audits_denial(monkeypatch):
    class Cursor:
        def execute(self, query, params=()):
            self.query = query
            self.params = params

        def fetchone(self):
            return None

    cursor = Cursor()
    audit_calls = []
    monkeypatch.setattr(mcp_server, "get_db", lambda: nullcontext(SimpleNamespace(cursor=lambda: cursor)))
    monkeypatch.setattr(
        mcp_server, "_authenticated_user",
        lambda _ctx: {"id": "user-1", "org_id": "org-1", "role": "reviewer"},
    )
    monkeypatch.setattr(
        mcp_server.AuditService, "log",
        lambda *args, **kwargs: audit_calls.append((args, kwargs)),
    )

    with pytest.raises(ToolError, match="Draft not found"):
        mcp_server.get_draft_findings(SimpleNamespace(headers={}), "other-org-draft")

    assert cursor.params == ("other-org-draft", "org-1")
    assert "d.org_id = ?" in cursor.query
    assert audit_calls[0][0][2] == "mcp_access_denied"


def test_mcp_rejects_unauthorized_role(monkeypatch):
    monkeypatch.setattr(
        mcp_server, "_authenticated_user",
        lambda _ctx: {"id": "user-1", "org_id": "org-1", "role": "auditor"},
    )
    with pytest.raises(ToolError, match="not permitted"):
        mcp_server.list_drafts(SimpleNamespace(headers={}))


def test_mcp_lists_only_authenticated_organization_and_validates_filters(monkeypatch):
    class Cursor:
        def execute(self, query, params=()):
            self.query = query
            self.params = params

        def fetchall(self):
            return [{
                "id": "draft-1",
                "title": "Launch",
                "content_type": "text",
                "current_version": 2,
                "status": "Scanned",
                "updated_at": "2026-11-09T10:00:00Z",
                "author_name": "Creator",
            }]

    cursor = Cursor()
    monkeypatch.setattr(mcp_server, "get_db", lambda: nullcontext(SimpleNamespace(cursor=lambda: cursor)))
    monkeypatch.setattr(
        mcp_server, "_authenticated_user",
        lambda _ctx: {"id": "user-1", "org_id": "org-1", "role": "reviewer"},
    )
    monkeypatch.setattr(mcp_server.AuditService, "log", lambda *args, **kwargs: None)
    ctx = SimpleNamespace(headers={})

    with pytest.raises(ToolError, match="recognized draft status"):
        mcp_server.list_drafts(ctx, status="Unknown")
    with pytest.raises(ToolError, match="limit must be"):
        mcp_server.list_drafts(ctx, limit=51)

    result = mcp_server.list_drafts(ctx, status="Scanned", limit=5)
    assert result.drafts[0].draft_id == "draft-1"
    assert "d.org_id = ?" in cursor.query
    assert cursor.params == ["org-1", "Scanned", 5]
