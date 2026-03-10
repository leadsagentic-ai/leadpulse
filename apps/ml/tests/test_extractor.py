"""Tests for NER entity extraction — unit tests for extract_entities()
and integration tests for the POST /extract-entities endpoint."""

import os
import types
from unittest.mock import MagicMock, patch

import pytest

from src.ner.extractor import EntityExtractionRequest, extract_entities


# ── spaCy mock helpers ────────────────────────────────────────────────────────

def _make_ent(text: str, label: str) -> MagicMock:
    ent = MagicMock()
    ent.text = text
    ent.label_ = label
    return ent


def _make_nlp(*entities: tuple[str, str]) -> MagicMock:
    """Return a mock spaCy Language whose __call__ returns a doc with given ents."""
    doc = MagicMock()
    doc.ents = [_make_ent(text, label) for text, label in entities]
    nlp = MagicMock()
    nlp.return_value = doc
    return nlp


def _req(post_text: str, author_bio: str | None = None) -> EntityExtractionRequest:
    return EntityExtractionRequest(post_text=post_text, author_bio=author_bio)


# ── Unit tests: extract_entities ─────────────────────────────────────────────

def test_extracts_person_name():
    nlp = _make_nlp(("Alice Johnson", "PERSON"))
    result = extract_entities(_req("Alice Johnson is looking for a CRM"), nlp)
    assert result.name == "Alice Johnson"


def test_extracts_org_company():
    nlp = _make_nlp(("Acme Corp", "ORG"))
    result = extract_entities(_req("We at Acme Corp are evaluating tools"), nlp)
    assert result.company == "Acme Corp"


def test_extracts_gpe_location():
    nlp = _make_nlp(("San Francisco", "GPE"))
    result = extract_entities(_req("Based in San Francisco, we need a tool"), nlp)
    assert result.location == "San Francisco"


def test_extracts_loc_location():
    nlp = _make_nlp(("Silicon Valley", "LOC"))
    result = extract_entities(_req("Working from Silicon Valley on enterprise SaaS"), nlp)
    assert result.location == "Silicon Valley"


def test_extracts_multiple_entities():
    nlp = _make_nlp(
        ("Bob Smith", "PERSON"),
        ("TechCo Inc", "ORG"),
        ("New York", "GPE"),
    )
    result = extract_entities(_req("Bob Smith from TechCo Inc in New York wants a demo"), nlp)
    assert result.name == "Bob Smith"
    assert result.company == "TechCo Inc"
    assert result.location == "New York"


def test_takes_first_entity_of_each_type():
    """Only the first PERSON, ORG, GPE is kept."""
    nlp = _make_nlp(
        ("Alice", "PERSON"),
        ("Bob", "PERSON"),   # ignored
        ("Acme", "ORG"),
        ("Initech", "ORG"),  # ignored
    )
    result = extract_entities(_req("Alice and Bob work at Acme and Initech"), nlp)
    assert result.name == "Alice"
    assert result.company == "Acme"


def test_returns_none_when_no_entities():
    nlp = _make_nlp()  # no entities
    result = extract_entities(_req("Looking for a good productivity tool"), nlp)
    assert result.name is None
    assert result.company is None
    assert result.location is None


def test_extracts_c_suite_job_title():
    nlp = _make_nlp()
    result = extract_entities(_req("I am the CTO and we need DevOps tooling"), nlp)
    assert result.job_title is not None
    assert "CTO" in result.job_title


def test_extracts_vp_job_title():
    nlp = _make_nlp()
    result = extract_entities(_req("VP of Sales here, evaluating CRM solutions for team"), nlp)
    assert result.job_title is not None
    assert "VP" in result.job_title


def test_extracts_founder_job_title():
    nlp = _make_nlp()
    result = extract_entities(_req("Co-founder at a Series A startup building sales automation"), nlp)
    assert result.job_title is not None
    assert "Founder" in result.job_title or "founder" in result.job_title


def test_extracts_head_of_job_title():
    nlp = _make_nlp()
    result = extract_entities(_req("Head of Engineering here, need better infra tooling badly"), nlp)
    assert result.job_title is not None
    assert "Head" in result.job_title


def test_author_bio_included_in_extraction():
    """author_bio is prepended to post_text so entities in bio are found."""
    nlp = _make_nlp(("Jane Doe", "PERSON"), ("StartupXYZ", "ORG"))
    result = extract_entities(
        _req(
            post_text="Looking for a project management tool for my team",
            author_bio="Jane Doe, CTO at StartupXYZ",
        ),
        nlp,
    )
    # The combined text passed to nlp should contain bio content
    call_arg = nlp.call_args[0][0]  # first positional arg to nlp()
    assert "Jane Doe" in call_arg
    assert "StartupXYZ" in call_arg
    assert result.name == "Jane Doe"
    assert result.company == "StartupXYZ"


def test_no_job_title_when_no_match():
    nlp = _make_nlp()
    result = extract_entities(_req("We need a tool that does reporting and analytics"), nlp)
    assert result.job_title is None


# ── Integration tests: POST /extract-entities endpoint ───────────────────────

@pytest.fixture
def extract_client():
    """TestClient with spacy.load real model (or mocked for speed)."""
    mock_nlp = _make_nlp(("Jane Smith", "PERSON"), ("Acme Corp", "ORG"), ("London", "GPE"))

    with patch("spacy.load", return_value=None):
        from main import app
        from fastapi.testclient import TestClient

        # Override the app state nlp so get_nlp() returns our mock
        app.state.nlp = mock_nlp
        yield TestClient(app)


def test_extract_endpoint_returns_200(extract_client):
    secret = os.environ["ML_SERVICE_SECRET"]
    response = extract_client.post(
        "/extract-entities",
        json={"post_text": "Jane Smith from Acme Corp in London is looking for CRM tools"},
        headers={"Authorization": f"Bearer {secret}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "name" in body
    assert "company" in body
    assert "location" in body
    assert "job_title" in body


def test_extract_endpoint_missing_auth_returns_403(extract_client):
    response = extract_client.post(
        "/extract-entities",
        json={"post_text": "Looking for a good CRM for our sales team here"},
    )
    assert response.status_code == 403


def test_extract_endpoint_wrong_secret_returns_401(extract_client):
    response = extract_client.post(
        "/extract-entities",
        json={"post_text": "Looking for a good CRM for our sales team here"},
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert response.status_code == 401


def test_extract_endpoint_empty_text_returns_422(extract_client):
    secret = os.environ["ML_SERVICE_SECRET"]
    response = extract_client.post(
        "/extract-entities",
        json={"post_text": ""},
        headers={"Authorization": f"Bearer {secret}"},
    )
    assert response.status_code == 422
