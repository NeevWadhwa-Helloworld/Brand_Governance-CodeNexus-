import pytest
from backend.services.model_adapter import (
    get_model_adapter,
    BaseModelAdapter,
    GeminiModelAdapter,
    LocalPrivateModelAdapter,
)


def test_model_adapter_factory_returns_adapter():
    adapter = get_model_adapter()
    assert isinstance(adapter, BaseModelAdapter)
    meta = adapter.get_provider_metadata()
    assert "provider" in meta
    assert "data_boundary" in meta
    assert "transmitted_data" in meta["data_boundary"]


def test_local_private_adapter_metadata():
    adapter = LocalPrivateModelAdapter(
        endpoint_url="http://127.0.0.1:11434/v1", model_name="llama3.2"
    )
    meta = adapter.get_provider_metadata()
    assert meta["is_local"] is True
    assert "Zero External Egress" in meta["hosting"]
    assert "Zero cloud egress" in meta["data_boundary"]["transmitted_data"]


def test_gemini_adapter_metadata():
    adapter = GeminiModelAdapter(api_key="test-key", model_name="gemini-2.5-flash")
    meta = adapter.get_provider_metadata()
    assert meta["is_local"] is False
    assert "Google Gemini Cloud API" in meta["provider"]

