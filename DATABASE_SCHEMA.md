# Database structure

The deployment database is Supabase PostgreSQL with the `vector` extension
enabled. SQLite remains available for local development when
`DATABASE_URL=sqlite:///./brand_governance.db`.

## Relationships

```text
organizations
  ├── users
  ├── guideline_versions
  │     ├── rules (optional vector embedding)
  │     ├── terminology_entries
  │     ├── approved_facts
  │     ├── brand_colors
  │     └── brand_logos
  ├── drafts ──< revisions ──< flags
  │      └──< comments
  └── audit_logs
```

## Tables

| Table | Purpose |
|---|---|
| `organizations` | Tenant boundary for all application records. |
| `users` | Organization members and hashed passwords; roles are creator, reviewer, or admin. |
| `guideline_versions` | Versioned Source-of-Truth documents and their raw imported text. |
| `rules` | Numbered policy clauses retrieved by the scanner. `embedding vector(768)` stores Gemini embeddings used by pgvector similarity search. |
| `terminology_entries` | Banned terms and preferred replacements. |
| `approved_facts` | Citable approved claims and metrics. |
| `brand_colors` | Approved palette and contrast requirements. |
| `brand_logos` | Approved logo metadata and hashes. |
| `drafts` | Submitted content metadata and lifecycle status. |
| `revisions` | Every scan/edit revision, score, coverage state, and extraction evidence. |
| `flags` | Explainable findings, fixes, resolutions, timestamps, and frame references. |
| `comments` | Creator/reviewer collaboration and decisions. |
| `audit_logs` | Hash-linked organization audit events. |

All API queries retain organization filters. PostgreSQL foreign keys enforce
record ownership relationships, while application authorization enforces role
and tenant access.

## Deployment

1. Copy `.env.example` to `.env`.
2. Set a random `SECRET_KEY` and paste the Supabase PostgreSQL connection URL.
3. Keep `ENVIRONMENT=production`, `DEBUG=False`, and set the real frontend host
   in `CORS_ORIGINS` and `TRUSTED_HOSTS`.
4. Deploy the backend to Render and the frontend to Vercel.
5. Add `DATABASE_URL`, `GEMINI_API_KEY`, and security settings as platform secrets.

To migrate an existing local database, point `DATABASE_URL` at PostgreSQL and
run `python -m backend.migrate_sqlite_to_postgres` from the project root before
deploying the Render service.
