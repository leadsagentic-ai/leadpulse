"""Lead scoring — 5-dimension weighted formula (0-100).

Dimensions:
  1. Intent Strength (max 30) — intent_weight × confidence × urgency × 30
  2. Data Completeness (max 25) — email+8, phone+6, linkedin+5, domain+4, name+2
  3. Platform Quality (max 20) — linkedin→10 … mastodon→4
  4. Engagement Signal (max 15) — recency: 24h→15, 72h→10, 7d→7, older→3
  5. Persona Match (max 10) — job_title+4, company+3, industry+3
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field

# ── Weights ───────────────────────────────────────────────────────────────────

INTENT_WEIGHTS: dict[str, float] = {
    "BUYING_INTENT": 1.0,
    "PAIN_SIGNAL": 0.8,
    "COMPARISON_INTENT": 0.7,
    "HIRING_INTENT": 0.5,
    "ANNOUNCEMENT_INTENT": 0.3,
}

PLATFORM_SCORES: dict[str, int] = {
    "linkedin": 10,
    "reddit": 8,
    "github": 7,
    "bluesky": 6,
    "threads": 5,
    "mastodon": 4,
}

ScoreTier = Literal["HOT", "WARM", "COOL", "WEAK", "DISCARD"]

HOT_THRESHOLD = 80
WARM_THRESHOLD = 60
COOL_THRESHOLD = 40
WEAK_THRESHOLD = 20

# ── Models ────────────────────────────────────────────────────────────────────


class LeadScoreInput(BaseModel):
    intent_type: str
    intent_confidence: float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    platform: str
    post_published_at: datetime
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    company_domain: str | None = None
    name: str | None = None
    job_title: str | None = None
    company: str | None = None
    industry: str | None = None


class LeadScoreOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    tier: ScoreTier


# ── Scoring logic ─────────────────────────────────────────────────────────────


def calculate_lead_score(lead: LeadScoreInput) -> int:
    """Return an integer score in [0, 100]."""
    # 1. Intent Strength
    intent_weight = INTENT_WEIGHTS.get(lead.intent_type, 0.3)
    intent_score = round(intent_weight * lead.intent_confidence * lead.urgency_score * 30)

    # 2. Data Completeness
    data_score = 0
    if lead.email:
        data_score += 8
    if lead.phone:
        data_score += 6
    if lead.linkedin_url:
        data_score += 5
    if lead.company_domain:
        data_score += 4
    if lead.name:
        data_score += 2

    # 3. Platform Quality
    platform_score = PLATFORM_SCORES.get(lead.platform.lower(), 2)

    # 4. Engagement Signal (recency)
    now = datetime.now(tz=timezone.utc)
    published = lead.post_published_at
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    age_hours = (now - published).total_seconds() / 3600
    if age_hours <= 24:
        recency_score = 15
    elif age_hours <= 72:
        recency_score = 10
    elif age_hours <= 168:
        recency_score = 7
    else:
        recency_score = 3

    # 5. Persona Match
    persona_score = 0
    if lead.job_title:
        persona_score += 4
    if lead.company:
        persona_score += 3
    if lead.industry:
        persona_score += 3

    total = intent_score + data_score + platform_score + recency_score + persona_score
    return min(100, max(0, total))


def get_score_tier(score: int) -> ScoreTier:
    """Map numeric score to tier label."""
    if score >= HOT_THRESHOLD:
        return "HOT"
    if score >= WARM_THRESHOLD:
        return "WARM"
    if score >= COOL_THRESHOLD:
        return "COOL"
    if score >= WEAK_THRESHOLD:
        return "WEAK"
    return "DISCARD"


def score_lead(lead: LeadScoreInput) -> LeadScoreOutput:
    """Public entry point: score + tier in one call."""
    score = calculate_lead_score(lead)
    return LeadScoreOutput(score=score, tier=get_score_tier(score))
