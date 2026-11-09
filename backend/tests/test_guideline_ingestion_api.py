from contextlib import contextmanager
from io import BytesIO

from fastapi import FastAPI
from starlette.testclient import TestClient

from backend.dependencies import get_current_user
from backend.routers import guidelines

from backend.services.guideline_ingestion import MAX_GUIDELINE_PDF_BYTES


class InMemoryDatabase:
    def __init__(self):
        self.versions = {}

    @contextmanager
    def connection(self):
        yield self

    def cursor(self):
        return self

    def execute(self, statement, params=()):
        if statement.lstrip().startswith("INSERT INTO guideline_versions"):
            version_id, org_id, version, title, raw_content, uploaded_at = params
            self.versions[version_id] = {
                "id": version_id,
                "org_id": org_id,
                "version": version,
                "title": title,
                "raw_content": raw_content,
                "is_active": 0,
                "uploaded_at": uploaded_at,
                "status": "pending",
            }
        elif statement.lstrip().startswith("SELECT id, version, title"):
            row = self.versions.get(params[0])
            self.result = row if row and row["org_id"] == params[1] and row["status"] == "pending" else None
        elif "UPDATE guideline_versions SET is_active = 0" in statement:
            for version in self.versions.values():
                if version["org_id"] == params[0] and version["is_active"]:
                    version.update(is_active=0, status="archived")
        elif "UPDATE guideline_versions SET is_active = 1" in statement:
            version = self.versions[params[0]]
            if version["org_id"] == params[1] and version["status"] == "pending":
                version.update(is_active=1, status="active")

    def fetchone(self):
        return self.result


def make_client(role, database):
    app = FastAPI()
    app.include_router(guidelines.router)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "admin-1" if role == "admin" else "creator-1",
        "org_id": "org-1",
        "role": role,
    }
    return TestClient(app)


def test_ingestion_requires_admin_authorization(monkeypatch):
    database = InMemoryDatabase()
    monkeypatch.setattr(guidelines, "get_db", database.connection)
    with make_client("creator", database) as client:
        response = client.post(
            "/api/guidelines/ingest",
            json={"title": "Rules", "version": "1", "content": "VOICE-01: Keep it clear"},
        )
    assert response.status_code == 403
    assert not database.versions


def test_staged_version_requires_explicit_confirmation_before_activation(monkeypatch):
    database = InMemoryDatabase()
    monkeypatch.setattr(guidelines, "get_db", database.connection)
    monkeypatch.setattr(guidelines.EmbeddingService, "embed", lambda _text: None)
    monkeypatch.setattr(guidelines.AuditService, "log", lambda *_args, **_kwargs: None)
    with make_client("admin", database) as client:
        staged = client.post(
            "/api/guidelines/ingest",
            json={"title": "Rules", "version": "1", "content": "VOICE-01: Keep it clear"},
        )
        version_id = staged.json()["version_id"]
        rejected = client.post(
            f"/api/guidelines/versions/{version_id}/activate",
            json={"confirmed": False},
        )
        assert database.versions[version_id]["status"] == "pending"
        activated = client.post(
            f"/api/guidelines/versions/{version_id}/activate",
            json={"confirmed": True},
        )

    assert staged.status_code == 200
    assert staged.json()["status"] == "pending_confirmation"
    assert rejected.status_code == 400
    assert activated.status_code == 200
    assert database.versions[version_id]["status"] == "active"


def test_pdf_upload_api_stages_parsed_rules_without_activating(monkeypatch):
    database = InMemoryDatabase()
    monkeypatch.setattr(guidelines, "get_db", database.connection)
    monkeypatch.setattr(guidelines.EmbeddingService, "embed", lambda _text: None)
    monkeypatch.setattr(guidelines.AuditService, "log", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        guidelines,
        "extract_pdf_rules",
        lambda _content: (
            "[PDF page 1]\nPolicy",
            [{"rule_id": "PDF-001", "category": "tone", "title": "Policy",
              "text": "Policy text", "details": "Source: PDF page 1.", "source_page": 1}],
        ),
    )
    with make_client("admin", database) as client:
        response = client.post(
            "/api/guidelines/ingest/pdf",
            data={"title": "PDF Policy", "version": "pdf-1"},
            files={"file": ("policy.pdf", BytesIO(b"%PDF-1.7 data"), "application/pdf")},
        )

    assert response.status_code == 200
    assert response.json()["rules"][0]["source_page"] == 1
    assert next(iter(database.versions.values()))["status"] == "pending"


def test_pdf_upload_api_rejects_oversized_pdf(monkeypatch):
    database = InMemoryDatabase()
    monkeypatch.setattr(guidelines, "get_db", database.connection)
    with make_client("admin", database) as client:
        response = client.post(
            "/api/guidelines/ingest/pdf",
            data={"title": "Large PDF", "version": "large"},
            files={"file": (
                "large.pdf",
                b"%PDF-" + b"x" * MAX_GUIDELINE_PDF_BYTES,
                "application/pdf",
            )},
        )

    assert response.status_code == 413
    assert "too large" in response.json()["detail"].lower()
    assert not database.versions
