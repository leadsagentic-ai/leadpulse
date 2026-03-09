"""Basic smoke tests for the ML service."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

# Patch settings + spaCy load before importing app
with patch("builtins.__import__", side_effect=lambda name, *a, **kw: __import__(name, *a, **kw)):
    pass


@pytest.fixture
def client():
    with patch("spacy.load", return_value=None):
        from main import app
        return TestClient(app)


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "leadpulse-ml"}
