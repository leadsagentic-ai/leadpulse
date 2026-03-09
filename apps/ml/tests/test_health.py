import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import MagicMock, patch


@pytest.fixture
def mock_settings(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key-placeholder")
    monkeypatch.setenv("ML_SERVICE_SECRET", "test-secret-placeholder-32-chars!!")


@pytest.mark.asyncio
async def test_health_endpoint(mock_settings):
    with patch("main.settings.ANTHROPIC_API_KEY", "sk-ant-test"), \
         patch("main.settings.ML_SERVICE_SECRET", "test-secret"), \
         patch("spacy.load", return_value=MagicMock()):
        from main import app
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "service": "leadpulse-ml"}
