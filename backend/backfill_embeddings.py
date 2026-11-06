"""Generate and store embeddings for existing active rules.

Requires GEMINI_API_KEY and a PostgreSQL/Supabase DATABASE_URL for production:
    python -m backend.backfill_embeddings
"""

import json

from backend.config import settings
from backend.database import get_db, init_db
from backend.services.embedding_service import EmbeddingService


def backfill():
    if not EmbeddingService.available():
        raise RuntimeError("Set GEMINI_API_KEY and VECTOR_SEARCH_ENABLED=True before backfilling.")
    if not settings.is_postgres:
        raise RuntimeError("Backfill requires PostgreSQL/pgvector; SQLite remains a local fallback.")

    init_db()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT r.id, r.rule_id, r.category, r.title, r.text, r.details
            FROM rules r
            JOIN guideline_versions gv ON r.version_id = gv.id
            WHERE r.is_active = 1 AND gv.is_active = 1 AND r.embedding IS NULL
            ORDER BY r.rule_id
        """)
        rules = cursor.fetchall()
        for rule in rules:
            text = f"{rule['rule_id']} {rule['category']} {rule['title']} {rule['text']} {rule.get('details') or ''}"
            values = EmbeddingService.embed(text)
            if not values:
                raise RuntimeError(f"No embedding returned for rule {rule['rule_id']}")
            cursor.execute(
                "UPDATE rules SET embedding_json = ?, embedding = ?::vector WHERE id = ?",
                (json.dumps(values), EmbeddingService.to_vector_literal(values), rule["id"]),
            )
            print(f"Embedded {rule['rule_id']}")


if __name__ == "__main__":
    backfill()
