import posixpath
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote

from supabase import create_client

from backend.config import settings


class MediaStorage:
    """Private object storage for uploaded draft media."""

    REF_PREFIX = "supabase://"
    DRAFTS_PREFIX = "drafts"
    SIGNED_URL_TTL_SECONDS = 3600

    @classmethod
    def is_storage_ref(cls, value: str | None) -> bool:
        return bool(value and value.startswith(cls.REF_PREFIX))

    @classmethod
    def _object_key(cls, reference: str) -> str:
        if not cls.is_storage_ref(reference):
            raise ValueError("Not a Supabase media reference.")
        key = reference[len(cls.REF_PREFIX):].strip("/")
        if not key.startswith(f"{cls.DRAFTS_PREFIX}/") or ".." in key.split("/"):
            raise ValueError("Invalid Supabase draft media reference.")
        return key

    @classmethod
    def _bucket(cls):
        if settings.MEDIA_STORAGE_BACKEND != "supabase":
            raise RuntimeError("Supabase media storage is not enabled.")
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for media storage."
            )
        if not settings.SUPABASE_STORAGE_BUCKET:
            raise RuntimeError("SUPABASE_STORAGE_BUCKET must not be empty.")
        client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        bucket_info = client.storage.get_bucket(settings.SUPABASE_STORAGE_BUCKET)
        is_public = (
            bucket_info.get("public")
            if isinstance(bucket_info, dict)
            else getattr(bucket_info, "public", None)
        )
        if is_public is not False:
            raise RuntimeError("The configured Supabase draft media bucket must be private.")
        return client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)

    @classmethod
    def upload_file(
        cls,
        file_path: Path,
        org_id: str,
        draft_id: str,
        filename: str,
        content_type: str,
    ) -> str:
        safe_name = Path(filename).name.replace("\\", "_").replace("/", "_")
        object_key = posixpath.join(
            cls.DRAFTS_PREFIX,
            quote(org_id, safe=""),
            quote(draft_id, safe=""),
            f"{uuid.uuid4().hex}-{quote(safe_name, safe='.-_')}",
        )
        with Path(file_path).open("rb") as file_obj:
            cls._bucket().upload(
                object_key,
                file_obj,
                {"content-type": content_type, "upsert": "false"},
            )
        return f"{cls.REF_PREFIX}{object_key}"

    @classmethod
    def download_to_path(cls, reference: str, destination: Path) -> Path:
        payload = cls._bucket().download(cls._object_key(reference))
        target = Path(destination)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)
        return target

    @classmethod
    def create_signed_url(cls, reference: str) -> str:
        result: Any = cls._bucket().create_signed_url(
            cls._object_key(reference), cls.SIGNED_URL_TTL_SECONDS
        )
        if isinstance(result, dict):
            signed_url = result.get("signedURL") or result.get("signedUrl")
        else:
            signed_url = getattr(result, "signed_url", None)
        if not isinstance(signed_url, str) or not signed_url:
            raise RuntimeError("Supabase did not return a signed media URL.")
        if signed_url.startswith("/"):
            return f"{settings.SUPABASE_URL}/storage/v1{signed_url}"
        return signed_url

    @classmethod
    def list_draft_objects(cls) -> list[str]:
        bucket = cls._bucket()
        objects: list[str] = []
        visited: set[str] = set()

        def walk(prefix: str) -> None:
            if prefix in visited:
                return
            visited.add(prefix)
            offset = 0
            while True:
                entries = bucket.list(
                    prefix,
                    {"limit": 1000, "offset": offset},
                )
                if not entries:
                    break
                for entry in entries:
                    name = entry.get("name")
                    if not name or name in {".", ".."}:
                        continue
                    key = posixpath.join(prefix, name) if prefix else name
                    if entry.get("id") is None and entry.get("metadata") is None:
                        walk(key)
                    else:
                        objects.append(key)
                if len(entries) < 1000:
                    break
                offset += len(entries)

        walk(cls.DRAFTS_PREFIX)
        return objects

    @classmethod
    def delete_object_keys(cls, keys: list[str]) -> None:
        bucket = cls._bucket()
        for offset in range(0, len(keys), 100):
            batch = keys[offset:offset + 100]
            if batch:
                bucket.remove(batch)

    @classmethod
    def delete_reference(cls, reference: str | None) -> None:
        if cls.is_storage_ref(reference):
            cls.delete_object_keys([cls._object_key(reference)])
            return
        if reference and reference.startswith("/static/uploads/"):
            filename = Path(reference).name
            if filename:
                (settings.STATIC_UPLOAD_DIR / filename).unlink(missing_ok=True)
