from typing import Annotated, Literal
import json

import anthropic
from fastapi import Depends
from pydantic import BaseModel, Field, model_validator

from src.intent.prompts import INTENT_SYSTEM_PROMPT


# ── Request / Response Models ──────────────────────────────────

class IntentClassificationRequest(BaseModel):
    model_config = {"strict": True}

    post_text:      str       = Field(min_length=1, max_length=10_000)
    author_bio:     str | None = Field(default=None, max_length=2_000)
    persona_filter: str | None = None
    platform:       Literal["reddit", "bluesky", "threads", "mastodon", "github", "linkedin"]

    @model_validator(mode="after")
    def text_must_be_classifiable(self) -> "IntentClassificationRequest":
        word_count = len(self.post_text.split())
        if word_count < 5:
            raise ValueError(f"Post text too short for classification: {word_count} words")
        return self


class IntentClassificationResponse(BaseModel):
    intent_type:   Literal["BUYING_INTENT", "PAIN_SIGNAL", "COMPARISON_INTENT", "HIRING_INTENT", "ANNOUNCEMENT_INTENT"]
    confidence:    float = Field(ge=0.0, le=1.0)
    urgency_score: float = Field(ge=0.0, le=1.0)
    justification: str   = Field(min_length=10, max_length=500)
    sentiment:     Literal["POSITIVE", "NEGATIVE", "NEUTRAL"]


# ── Dependency Injection ───────────────────────────────────────

async def get_anthropic_client() -> anthropic.AsyncAnthropic:
    from main import settings  # noqa: PLC0415 — imported here to avoid circular import
    return anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


AnthropicDep = Annotated[anthropic.AsyncAnthropic, Depends(get_anthropic_client)]


# ── Classification ─────────────────────────────────────────────

async def classify_post_intent(
    request: IntentClassificationRequest,
    client: AnthropicDep,
) -> IntentClassificationResponse:
    """Classify post intent using Claude Haiku — cost-optimized."""

    user_message = f"""Platform: {request.platform}
Post text: {request.post_text}
Author bio: {request.author_bio or "Not available"}
Target persona: {request.persona_filter or "Not specified"}

Classify the intent of this post."""

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",  # Cheapest Claude model
        max_tokens=300,
        system=INTENT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    data = json.loads(raw)
    return IntentClassificationResponse(**data)
