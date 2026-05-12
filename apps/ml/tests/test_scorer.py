"""Tests for the lead scoring module — calculate_lead_score(), get_score_tier(),
and score_lead()."""

from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from src.scoring.scorer import (
    LeadScoreInput,
    LeadScoreOutput,
    calculate_lead_score,
    get_score_tier,
    score_lead,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def hours_ago(h: float) -> datetime:
    return datetime.now(tz=timezone.utc) - timedelta(hours=h)


def base_input(**overrides) -> LeadScoreInput:
    """Minimal valid input — all optional fields None, fresh post (< 24h)."""
    defaults = {
        "intent_type": "BUYING_INTENT",
        "intent_confidence": 1.0,
        "urgency_score": 1.0,
        "platform": "reddit",
        "post_published_at": hours_ago(1),
    }
    defaults.update(overrides)
    return LeadScoreInput(**defaults)


# ── Intent Strength (max 30) ──────────────────────────────────────────────────


def test_buying_intent_full_confidence_and_urgency():
    """BUYING_INTENT weight=1.0 × conf=1 × urgency=1 × 30 = 30pts."""
    lead = base_input(post_published_at=hours_ago(200))  # old → recency=3
    score = calculate_lead_score(lead)
    # intent=30, data=0, platform=8(reddit), recency=3, persona=0 → 41
    assert score == 41


def test_pain_signal_weight():
    """PAIN_SIGNAL weight=0.8 → round(0.8×1×1×30) = 24."""
    lead = base_input(intent_type="PAIN_SIGNAL", post_published_at=hours_ago(200))
    score = calculate_lead_score(lead)
    # intent=24, data=0, platform=8, recency=3 → 35
    assert score == 35


def test_comparison_intent_weight():
    lead = base_input(intent_type="COMPARISON_INTENT", post_published_at=hours_ago(200))
    score = calculate_lead_score(lead)
    # round(0.7×1×1×30)=21, platform=8, recency=3 → 32
    assert score == 32


def test_hiring_intent_weight():
    lead = base_input(intent_type="HIRING_INTENT", post_published_at=hours_ago(200))
    score = calculate_lead_score(lead)
    # round(0.5×1×1×30)=15, platform=8, recency=3 → 26
    assert score == 26


def test_announcement_intent_weight():
    lead = base_input(intent_type="ANNOUNCEMENT_INTENT", post_published_at=hours_ago(200))
    score = calculate_lead_score(lead)
    # round(0.3×1×1×30)=9, platform=8, recency=3 → 20
    assert score == 20


def test_unknown_intent_type_uses_default_weight():
    """Unknown intent type falls back to weight 0.3."""
    lead = base_input(intent_type="UNKNOWN_INTENT", post_published_at=hours_ago(200))
    score = calculate_lead_score(lead)
    # round(0.3×1×1×30)=9, platform=8, recency=3 → 20
    assert score == 20


def test_fractional_confidence_and_urgency_rounds_correctly():
    """round(1.0 × 0.5 × 0.5 × 30) = round(7.5) = 8."""
    lead = base_input(intent_confidence=0.5, urgency_score=0.5, post_published_at=hours_ago(200))
    score = calculate_lead_score(lead)
    # intent=8, platform=8, recency=3 → 19
    assert score == 19


# ── Data Completeness (max 25) ────────────────────────────────────────────────


def test_email_adds_8_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), email="a@b.com"))
    assert b - a == 8


def test_phone_adds_6_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), phone="+15551234567"))
    assert b - a == 6


def test_linkedin_url_adds_5_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), linkedin_url="https://linkedin.com/in/test"))
    assert b - a == 5


def test_company_domain_adds_4_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), company_domain="acme.com"))
    assert b - a == 4


def test_name_adds_2_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), name="Alice"))
    assert b - a == 2


def test_all_data_fields_sum_to_25():
    lead = base_input(
        post_published_at=hours_ago(200),
        email="a@b.com",
        phone="+15551234567",
        linkedin_url="https://linkedin.com/in/test",
        company_domain="acme.com",
        name="Alice",
    )
    base = base_input(post_published_at=hours_ago(200))
    assert calculate_lead_score(lead) - calculate_lead_score(base) == 25


# ── Platform Quality (max 20) ─────────────────────────────────────────────────


@pytest.mark.parametrize("platform,expected", [
    ("linkedin", 10),
    ("reddit", 8),
    ("github", 7),
    ("bluesky", 6),
    ("threads", 5),
    ("mastodon", 4),
    ("unknown_platform", 2),
])
def test_platform_scores(platform, expected):
    lead = base_input(platform=platform, post_published_at=hours_ago(200))
    base = base_input(platform="dummy_platform_x", post_published_at=hours_ago(200))
    # Compare platform portions by subtracting the unknown-platform (2pt) base
    diff = calculate_lead_score(lead) - calculate_lead_score(base)
    assert diff == expected - 2


def test_platform_case_insensitive():
    lower = calculate_lead_score(base_input(platform="linkedin", post_published_at=hours_ago(200)))
    upper = calculate_lead_score(base_input(platform="LINKEDIN", post_published_at=hours_ago(200)))
    assert lower == upper


# ── Engagement Signal / Recency (max 15) ─────────────────────────────────────


@pytest.mark.parametrize("age_hours,expected_recency", [
    (1, 15),
    (23, 15),
    (25, 10),
    (71, 10),
    (73, 7),
    (167, 7),
    (169, 3),
    (500, 3),
])
def test_recency_buckets(age_hours, expected_recency):
    rich = base_input(post_published_at=hours_ago(age_hours), platform="dummy_platform_x")
    old = base_input(post_published_at=hours_ago(500), platform="dummy_platform_x")
    diff = calculate_lead_score(rich) - calculate_lead_score(old)
    assert diff == expected_recency - 3  # old post always gives 3


# ── Persona Match (max 10) ────────────────────────────────────────────────────


def test_job_title_adds_4_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), job_title="VP of Sales"))
    assert b - a == 4


def test_company_adds_3_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), company="Acme Corp"))
    assert b - a == 3


def test_industry_adds_3_points():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(post_published_at=hours_ago(200), industry="SaaS"))
    assert b - a == 3


def test_all_persona_fields_sum_to_10():
    a = calculate_lead_score(base_input(post_published_at=hours_ago(200)))
    b = calculate_lead_score(base_input(
        post_published_at=hours_ago(200),
        job_title="VP of Sales",
        company="Acme Corp",
        industry="SaaS",
    ))
    assert b - a == 10


# ── Score boundaries ──────────────────────────────────────────────────────────


def test_score_never_exceeds_100():
    lead = LeadScoreInput(
        intent_type="BUYING_INTENT",
        intent_confidence=1.0,
        urgency_score=1.0,
        platform="linkedin",
        post_published_at=hours_ago(1),
        email="a@b.com",
        phone="+15551234567",
        linkedin_url="https://linkedin.com/in/test",
        company_domain="acme.com",
        name="Alice",
        job_title="VP of Sales",
        company="Acme Corp",
        industry="SaaS",
    )
    assert calculate_lead_score(lead) <= 100


def test_score_never_below_zero():
    lead = base_input(
        intent_type="ANNOUNCEMENT_INTENT",
        intent_confidence=0.0,
        urgency_score=0.0,
        platform="unknown",
        post_published_at=hours_ago(1000),
    )
    assert calculate_lead_score(lead) >= 0


# ── get_score_tier ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("score,expected_tier", [
    (100, "HOT"),
    (80, "HOT"),
    (79, "WARM"),
    (60, "WARM"),
    (59, "COOL"),
    (40, "COOL"),
    (39, "WEAK"),
    (20, "WEAK"),
    (19, "DISCARD"),
    (0, "DISCARD"),
])
def test_get_score_tier_thresholds(score, expected_tier):
    assert get_score_tier(score) == expected_tier


# ── score_lead (combined) ────────────────────────────────────────────────────


def test_score_lead_returns_output_model():
    lead = base_input()
    result = score_lead(lead)
    assert isinstance(result, LeadScoreOutput)
    assert 0 <= result.score <= 100
    assert result.tier in {"HOT", "WARM", "COOL", "WEAK", "DISCARD"}


def test_score_lead_tier_consistent_with_score():
    lead = base_input()
    result = score_lead(lead)
    assert result.tier == get_score_tier(result.score)


# ── Input validation ──────────────────────────────────────────────────────────


def test_confidence_above_1_raises():
    with pytest.raises(ValidationError):
        LeadScoreInput(
            intent_type="BUYING_INTENT",
            intent_confidence=1.5,
            urgency_score=0.8,
            platform="reddit",
            post_published_at=hours_ago(1),
        )


def test_confidence_below_0_raises():
    with pytest.raises(ValidationError):
        LeadScoreInput(
            intent_type="BUYING_INTENT",
            intent_confidence=-0.1,
            urgency_score=0.8,
            platform="reddit",
            post_published_at=hours_ago(1),
        )


def test_naive_datetime_treated_as_utc():
    """A timezone-naive datetime is treated as UTC — no crash."""
    naive = datetime.utcnow()
    lead = LeadScoreInput(
        intent_type="BUYING_INTENT",
        intent_confidence=1.0,
        urgency_score=1.0,
        platform="reddit",
        post_published_at=naive,
    )
    score = calculate_lead_score(lead)
    assert 0 <= score <= 100
