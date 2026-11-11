from types import SimpleNamespace

import pytest
from storage3.exceptions import StorageApiError

from backend.services.media_storage import MediaStorage


class FakeBucket:
    def __init__(self):
        self.uploaded = []
        self.downloaded = []
        self.removed = []

    def upload(self, key, file_obj, options):
        self.uploaded.append((key, file_obj.read(), options))

    def download(self, key):
        self.downloaded.append(key)
        return b"draft media"

    def create_signed_url(self, key, expires_in):
        assert expires_in == MediaStorage.SIGNED_URL_TTL_SECONDS
        return {"signedURL": f"/object/sign/draft-media/{key}?token=temporary"}

    def list(self, path, options):
        if path == "drafts":
            return [{"name": "org-1", "id": None, "metadata": None}]
        if path == "drafts/org-1":
            return [{"name": "draft-1", "id": None, "metadata": None}]
        if path == "drafts/org-1/draft-1":
            return [{"name": "creative.png", "id": "object-id", "metadata": {}}]
        return []

    def remove(self, keys):
        self.removed.extend(keys)


@pytest.fixture
def configured_bucket(monkeypatch):
    bucket = FakeBucket()
    monkeypatch.setattr("backend.services.media_storage.settings.MEDIA_STORAGE_BACKEND", "supabase")
    monkeypatch.setattr("backend.services.media_storage.settings.SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr("backend.services.media_storage.settings.SUPABASE_SERVICE_ROLE_KEY", "test-only")
    monkeypatch.setattr("backend.services.media_storage.settings.SUPABASE_STORAGE_BUCKET", "draft-media")
    monkeypatch.setattr(
        "backend.services.media_storage.create_client",
        lambda *_args: SimpleNamespace(
            storage=SimpleNamespace(
                get_bucket=lambda _bucket_name: SimpleNamespace(public=False),
                from_=lambda _bucket_name: bucket,
            )
        ),
    )
    return bucket


def test_upload_stores_only_a_draft_reference_and_uses_private_bucket(configured_bucket, tmp_path):
    media_path = tmp_path / "source.mp4"
    media_path.write_bytes(b"video")

    reference = MediaStorage.upload_file(
        media_path, "org-1", "draft-1", "campaign video.mp4", "video/mp4"
    )

    assert reference.startswith("supabase://drafts/org-1/draft-1/")
    uploaded_key, uploaded_bytes, options = configured_bucket.uploaded[0]
    assert reference == f"supabase://{uploaded_key}"
    assert uploaded_key.endswith("-campaign%20video.mp4")
    assert uploaded_bytes == b"video"
    assert options == {"content-type": "video/mp4", "upsert": "false"}


def test_missing_bucket_is_created_as_private(monkeypatch, tmp_path):
    bucket = FakeBucket()
    bucket_info = SimpleNamespace(public=False)
    create_calls = []
    get_calls = []

    def get_bucket(name):
        get_calls.append(name)
        if len(get_calls) == 1:
            raise StorageApiError("Bucket not found", "NotFound", 404)
        return bucket_info

    storage = SimpleNamespace(
        get_bucket=get_bucket,
        create_bucket=lambda name, options: create_calls.append((name, options)),
        from_=lambda _bucket_name: bucket,
    )
    monkeypatch.setattr("backend.services.media_storage.settings.MEDIA_STORAGE_BACKEND", "supabase")
    monkeypatch.setattr("backend.services.media_storage.settings.SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr("backend.services.media_storage.settings.SUPABASE_SERVICE_ROLE_KEY", "test-only")
    monkeypatch.setattr("backend.services.media_storage.settings.SUPABASE_STORAGE_BUCKET", "draft-media")
    monkeypatch.setattr(
        "backend.services.media_storage.create_client",
        lambda *_args: SimpleNamespace(storage=storage),
    )
    media_path = tmp_path / "source.wav"
    media_path.write_bytes(b"audio")

    MediaStorage.upload_file(media_path, "org-1", "draft-1", "source.wav", "audio/wav")

    assert get_calls == ["draft-media", "draft-media"]
    assert create_calls == [("draft-media", {"public": False})]


def test_download_signed_url_and_draft_object_listing(configured_bucket, tmp_path):
    reference = "supabase://drafts/org-1/draft-1/creative.png"
    destination = tmp_path / "scan" / "creative.png"

    result = MediaStorage.download_to_path(reference, destination)

    assert result == destination
    assert destination.read_bytes() == b"draft media"
    assert configured_bucket.downloaded == ["drafts/org-1/draft-1/creative.png"]
    assert MediaStorage.create_signed_url(reference) == (
        "https://project.supabase.co/storage/v1/object/sign/"
        "draft-media/drafts/org-1/draft-1/creative.png?token=temporary"
    )
    assert MediaStorage.list_draft_objects() == [
        "drafts/org-1/draft-1/creative.png"
    ]


def test_rejects_references_outside_managed_draft_prefix():
    with pytest.raises(ValueError):
        MediaStorage._object_key("supabase://guidelines/logo.png")
    with pytest.raises(ValueError):
        MediaStorage._object_key("supabase://drafts/org/../secret.png")
