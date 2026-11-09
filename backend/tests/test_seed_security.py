import asyncio
from contextlib import contextmanager

import pytest

from backend import seed_data
from backend.config import settings


class ProductionSeedDatabase:
    def __init__(self, organization=None, users=None):
        self.organizations = {organization["slug"]: dict(organization)} if organization else {}
        self.users = [dict(user) for user in users or []]
        self.result = None

    def cursor(self):
        return self

    def execute(self, query, params=()):
        query = query.strip()
        if query.startswith("SELECT id FROM organizations WHERE slug ="):
            self.result = self.organizations.get(params[0])
        elif query.startswith("SELECT id, email, role, password_hash FROM users"):
            self.result = [
                user for user in self.users if user["org_id"] == params[0]
            ]
        elif "role = 'admin' AND password_hash IS NOT NULL" in query:
            self.result = next(
                (
                    user for user in self.users
                    if user["org_id"] == params[0]
                    and user["role"] == "admin"
                    and user["password_hash"]
                ),
                None,
            )
        elif query.startswith("SELECT id FROM users WHERE email ="):
            self.result = next(
                (user for user in self.users if user["email"] == params[0]),
                None,
            )
        elif query.startswith("SELECT id, org_id, role, password_hash FROM users"):
            self.result = next(
                (user for user in self.users if user["email"] == params[0]),
                None,
            )
        elif query.startswith("INSERT INTO organizations"):
            org_id, name, slug, created_at = params
            self.organizations[slug] = {
                "id": org_id, "name": name, "slug": slug, "created_at": created_at,
            }
        elif query.startswith("INSERT INTO users"):
            user_id, org_id, email, name, created_at, password_hash = params
            self.users.append({
                "id": user_id, "org_id": org_id, "email": email, "name": name,
                "role": "admin", "created_at": created_at, "password_hash": password_hash,
            })
        else:
            raise AssertionError(f"Unexpected production seed query: {query}")

    def fetchone(self):
        return self.result

    def fetchall(self):
        return self.result


def _setup_production(monkeypatch, database):
    monkeypatch.setattr(seed_data, "init_db", lambda: None)

    @contextmanager
    def fake_get_db():
        yield database

    monkeypatch.setattr(seed_data, "get_db", fake_get_db)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "SECRET_KEY", "test-secret-key-for-seed")


def test_production_does_not_seed_demo_users_without_explicit_bootstrap(monkeypatch):
    database = ProductionSeedDatabase()
    _setup_production(monkeypatch, database)
    monkeypatch.setattr(settings, "INITIAL_ADMIN_EMAIL", "")
    monkeypatch.setattr(settings, "INITIAL_ADMIN_NAME", "")
    monkeypatch.setattr(settings, "INITIAL_ADMIN_PASSWORD", "")
    monkeypatch.setattr(settings, "INITIAL_ORG_NAME", "")
    monkeypatch.setattr(settings, "INITIAL_ORG_SLUG", "")

    with pytest.raises(RuntimeError, match="Refusing to seed demo data in production"):
        asyncio.run(seed_data.seed_database())

    assert not database.organizations
    assert not database.users


def test_production_bootstrap_creates_only_configured_admin(monkeypatch):
    database = ProductionSeedDatabase()
    _setup_production(monkeypatch, database)
    monkeypatch.setattr(settings, "INITIAL_ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setattr(settings, "INITIAL_ADMIN_NAME", "Initial Admin")
    monkeypatch.setattr(settings, "INITIAL_ADMIN_PASSWORD", "long-one-time-password")
    monkeypatch.setattr(settings, "INITIAL_ORG_NAME", "Example Org")
    monkeypatch.setattr(settings, "INITIAL_ORG_SLUG", "example-org")

    asyncio.run(seed_data.seed_database())

    assert len(database.organizations) == 1
    assert len(database.users) == 1
    admin = database.users[0]
    assert admin["role"] == "admin"
    assert admin["email"] == "admin@example.com"
    assert admin["password_hash"] != "long-one-time-password"
    assert len(admin["password_hash"]) == 64
