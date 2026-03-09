"""Tests for intent classification — unit tests for classify_post_intent()
and integration tests for the POST /classify endpoint."""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from src.intent.classifier import (
    IntentClassificationRequest,
    IntentClassificationResponse,
    classify_post_intent,
    get_anthropic_client,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_mock_anthropic_client(
    intent_type: str,
    confidence: float = 0.9,
    urgency_score: float = 0.8,
    sentiment: str = "POSITIVE",
) -> AsyncMock:
    """Return a mock anthropic.AsyncAnthropic whose messages.create returns
    a valid IntentClassificationResponse JSON payload."""
    payload = {
        "intent_type": intent_type,
        "confidence": confidence,
        "urgency_score": urgency_score,
        "justification": "The post clearly signals this intent based on the language used.",
        "sentiment": sentiment,
    }
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps(payload))]
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=mock_message)
    return client


def _make_request(
    post_text: str = "We are evaluating CRM tools for our enterprise sales team",
    platform: str = "reddit",
) -> IntentClassificationRequest:
    return IntentClassificationRequest(post_text=post_text, platform=platform)  # type: ignore[arg-type]


# ── Unit tests: classify_post_intent ─────────────────────────────────────────

async def test_buying_intent():
    client = _make_mock_anthropic_client("BUYING_INTENT", confidence=0.92)
    request = _make_request("We are actively evaluating enterprise CRM tools for our sales team")
    result = await classify_post_intent(request, client)

    assert isinstance(result, IntentClassificationResponse)
    assert result.intent_type == "BUYING_INTENT"
    assert result.confidence == 0.92
    assert result.urgency_score == 0.8
    assert result.sentiment == "POSITIVE"
    assert len(result.justification) >= 10
    client.messages.create.assert_awaited_once()


async def test_pain_signal():
    client = _make_mock_anthropic_client("PAIN_SIGNAL", confidence=0.85, urgency_score=0.7, sentiment="NEGATIVE")
    request = _make_request("Our current CRM is incredibly slow and losing us deals every single day")
    result = await classify_post_intent(request, client)

    assert result.intent_type == "PAIN_SIGNAL"
    assert result.confidence == 0.85
    assert result.sentiment == "NEGATIVE"


async def test_comparison_intent():
    client = _make_mock_anthropic_client("COMPARISON_INTENT", confidence=0.78, urgency_score=0.5, sentiment="NEUTRAL")
    request = _make_request("What are the key differences between Salesforce and HubSpot for mid-market companies?")
    result = await classify_post_intent(request, client)

    assert result.intent_type == "COMPARISON_INTENT"
    assert result.confidence == 0.78


async def test_hiring_intent():
    client = _make_mock_anthropic_client("HIRING_INTENT", confidence=0.95, urgency_score=0.6)
    request = _make_request("We are hiring senior enterprise sales engineers to scale our go-to-market team")
    result = await classify_post_intent(request, client)

    assert result.intent_type == "HIRING_INTENT"
    assert result.confidence == 0.95


async def test_announcement_intent():
    client = _make_mock_anthropic_client("ANNOUNCEMENT_INTENT", confidence=0.88, urgency_score=0.3)
    request = _make_request("Excited to announce we just closed our Series B funding round of ten million")
    result = await classify_post_intent(request, client)

    assert result.intent_type == "ANNOUNCEMENT_INTENT"
    assert result.confidence == 0.88


async def test_classify_forwards_platform_and_text_to_claude():
    """The user message passed to Claude includes platform name and post text."""
    client = _make_mock_anthropic_client("BUYING_INTENT")
    request = _make_request(
        post_text="Looking to purchase an enterprise analytics platform for our team",
        platform="linkedin",
    )
    await classify_post_intent(request, client)

    call_kwargs = client.messages.create.call_args.kwargs
    user_message = call_kwargs["messages"][0]["content"]
    assert "linkedin" in user_message
    assert "Looking to purchase" in user_message


async def test_author_bio_and_persona_included_in_message():
    """Optional author_bio and persona_filter appear in the Claude prompt."""
    client = _make_mock_anthropic_client("BUYING_INTENT")
    request = IntentClassificationRequest(
        post_text="We are evaluating CRM solutions for our B2B sales operations team",
        platform="reddit",
        author_bio="VP of Sales at a 200-person SaaS company",
        persona_filter="B2B SaaS decision maker",
    )
    await classify_post_intent(request, client)

    call_kwargs = client.messages.create.call_args.kwargs
    user_message = call_kwargs["messages"][0]["content"]
    assert "VP of Sales" in user_message
    assert "B2B SaaS decision maker" in user_message


async def test_malformed_json_from_claude_raises():
    """If Claude returns non-JSON text, an exception propagates."""
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text="Sorry, I cannot classify this post.")]
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=mock_message)
    request = _make_request("We need a software platform for our operations and engineering department")

    with pytest.raises(Exception):  # json.JSONDecodeError or ValidationError
        await classify_post_intent(request, client)


async def test_claude_returns_invalid_intent_type_raises_validation_error():
    """If Claude returns an unknown intent_type, Pydantic raises ValidationError."""
    payload = {
        "intent_type": "UNKNOWN_TYPE",
        "confidence": 0.9,
        "urgency_score": 0.8,
        "justification": "Some justification text here that is long enough.",
        "sentiment": "POSITIVE",
    }
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text=json.dumps(payload))]
    client = AsyncMock()
    client.messages.create = AsyncMock(return_value=mock_message)
    request = _make_request("We are evaluating tools for managing enterprise sales pipelines")

    with pytest.raises(ValidationError):
        await classify_post_intent(request, client)


# ── Validation tests: IntentClassificationRequest ────────────────────────────

def test_short_post_raises_validation_error():
    """Posts with fewer than 5 words are rejected before any API call."""
    with pytest.raises(ValidationError) as exc_info:
        IntentClassificationRequest(post_text="buy now", platform="reddit")  # type: ignore[arg-type]
    assert "too short" in str(exc_info.value).lower()


def test_post_exactly_five_words_is_valid():
    """Posts with exactly 5 words pass validation."""
    req = IntentClassificationRequest(post_text="we need sales crm today", platform="reddit")  # type: ignore[arg-type]
    assert req.post_text == "we need sales crm today"


def test_invalid_platform_raises_validation_error():
    """Unsupported platform strings are rejected."""
    with pytest.raises(ValidationError):
        IntentClassificationRequest(
            post_text="We are evaluating CRM platforms for our sales team",
            platform="twitter",  # not in the allowed literals  # type: ignore[arg-type]
        )


def test_optional_fields_default_to_none():
    """author_bio and persona_filter default to None."""
    req = IntentClassificationRequest(
        post_text="Considering enterprise software purchase for our finance and operations team",
        platform="linkedin",
    )
    assert req.author_bio is None
    assert req.persona_filter is None


def test_all_valid_platforms_accepted():
    """Every supported platform passes validation."""
    platforms = ["reddit", "bluesky", "threads", "mastodon", "github", "linkedin"]
    for platform in platforms:
        req = IntentClassificationRequest(
            post_text="Looking for tools to manage our enterprise sales pipeline deals",
            platform=platform,  # type: ignore[arg-type]
        )
        assert req.platform == platform


# ── Integration tests: POST /classify endpoint ───────────────────────────────

@pytest.fixture
def classify_client():
    """TestClient with spacy.load patched and Anthropic client overridden."""
    mock_intent_client = _make_mock_anthropic_client("BUYING_INTENT")

    with patch("spacy.load", return_value=None):
        from main import app
        from fastapi.testclient import TestClient

        app.dependency_overrides[get_anthropic_client] = lambda: mock_intent_client
        yield TestClient(app)
        app.dependency_overrides.clear()


def test_classify_endpoint_returns_200(classify_client):
    import os
    secret = os.environ["ML_SERVICE_SECRET"]
    response = classify_client.post(
        "/classify",
        json={
            "post_text": "We are actively evaluating enterprise CRM tools for our b2b sales team",
            "platform": "reddit",
        },
        headers={"Authorization": f"Bearer {secret}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent_type"] == "BUYING_INTENT"
    assert 0.0 <= body["confidence"] <= 1.0
    assert 0.0 <= body["urgency_score"] <= 1.0
    assert body["sentiment"] in {"POSITIVE", "NEGATIVE", "NEUTRAL"}


def test_classify_endpoint_missing_auth_returns_403(classify_client):
    """No Authorization header → 403 (HTTPBearer default)."""
    response = classify_client.post(
        "/classify",
        json={
            "post_text": "We are actively evaluating enterprise CRM tools for our sales team",
            "platform": "reddit",
        },
    )
    assert response.status_code == 403


def test_classify_endpoint_wrong_secret_returns_401(classify_client):
    response = classify_client.post(
        "/classify",
        json={
            "post_text": "We are actively evaluating enterprise CRM tools for our sales team",
            "platform": "reddit",
        },
        headers={"Authorization": "Bearer wrong-secret-value"},
    )
    assert response.status_code == 401


def test_classify_endpoint_short_text_returns_422(classify_client):
    import os
    secret = os.environ["ML_SERVICE_SECRET"]
    response = classify_client.post(
        "/classify",
        json={"post_text": "buy now", "platform": "reddit"},
        headers={"Authorization": f"Bearer {secret}"},
    )
    assert response.status_code == 422
