"""Embedding provider boundary used by pgvector retrieval."""

from typing import Optional

from backend.config import settings


class EmbeddingService:
    @staticmethod
    def available() -> bool:
        return bool(
            settings.VECTOR_SEARCH_ENABLED
            and settings.GEMINI_API_KEY
            and settings.GEMINI_API_KEY != "your_gemini_api_key_here"
        )

    @staticmethod
    def embed(text: str) -> Optional[list[float]]:
        if not text.strip() or not EmbeddingService.available():
            return None

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        response = client.models.embed_content(
            model=settings.EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(
                output_dimensionality=settings.EMBEDDING_DIMENSIONS
            ),
        )
        embeddings = getattr(response, "embeddings", None) or []
        if not embeddings:
            return None
        values = getattr(embeddings[0], "values", None)
        if not values or len(values) != settings.EMBEDDING_DIMENSIONS:
            raise RuntimeError(
                f"Embedding provider returned {len(values or [])} dimensions; "
                f"expected {settings.EMBEDDING_DIMENSIONS}."
            )
        return [float(value) for value in values]

    @staticmethod
    def to_vector_literal(values: list[float]) -> str:
        return "[" + ",".join(f"{value:.8f}" for value in values) + "]"
