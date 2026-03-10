"""NER entity extraction using spaCy en_core_web_sm.

Extracts: PERSON (name), ORG (company), GPE (location), job title (regex).
Phase 2 upgrade: en_core_web_trf for higher accuracy.
"""

import re
from typing import Annotated

import spacy
from fastapi import Depends, Request
from pydantic import BaseModel, Field


# ── Job-title regex patterns ───────────────────────────────────

_JOB_TITLE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r'\b(CEO|CTO|CFO|COO|CPO|CMO|CRO|CISO|CDO)\b'),
    re.compile(r'\b(Founder|Co-[Ff]ounder)\b'),
    re.compile(
        r'\b(VP|Vice President)\s+of\s+[\w\s]{2,40}',
        re.IGNORECASE,
    ),
    re.compile(
        r'\b(Head\s+of|Director\s+of|Director,)\s+[\w\s]{2,40}',
        re.IGNORECASE,
    ),
    re.compile(
        r'\b(Senior|Lead|Principal|Staff|Jr\.?|Junior)\s+'
        r'[\w\s]{0,20}(Engineer|Developer|Designer|Architect|Scientist|Analyst|Researcher|Consultant)\b',
        re.IGNORECASE,
    ),
    re.compile(
        r'\b(Product|Engineering|Sales|Account|Marketing|Operations|Growth|Customer Success)\s+Manager\b',
        re.IGNORECASE,
    ),
    re.compile(
        r'\bI(?:\'m| am) (?:a |an )?([\w\s]{3,40}?)\s+(?:at|@)\s+\w',
        re.IGNORECASE,
    ),
]


# ── Request / Response Models ──────────────────────────────────

class EntityExtractionRequest(BaseModel):
    post_text:  str       = Field(min_length=1, max_length=10_000)
    author_bio: str | None = Field(default=None, max_length=2_000)


class EntityExtractionResponse(BaseModel):
    name:      str | None = None
    company:   str | None = None
    location:  str | None = None
    job_title: str | None = None


# ── Dependency Injection ───────────────────────────────────────

def get_nlp(request: Request) -> spacy.Language:
    """Return the spaCy model loaded during app lifespan."""
    return request.app.state.nlp


NlpDep = Annotated[spacy.Language, Depends(get_nlp)]


# ── Extraction ─────────────────────────────────────────────────

def extract_entities(
    request: EntityExtractionRequest,
    nlp: spacy.Language,
) -> EntityExtractionResponse:
    """Extract name, company, location, and job title from post + bio."""

    # Combine post and bio — bio often contains cleaner entity mentions
    combined = request.post_text
    if request.author_bio:
        combined = f"{request.author_bio}\n\n{request.post_text}"

    doc = nlp(combined)

    name: str | None = None
    company: str | None = None
    location: str | None = None
    job_title: str | None = None

    # spaCy NER — take the first occurrence of each entity type
    for ent in doc.ents:
        if ent.label_ == "PERSON" and name is None:
            name = ent.text.strip()
        elif ent.label_ == "ORG" and company is None:
            company = ent.text.strip()
        elif ent.label_ in ("GPE", "LOC") and location is None:
            location = ent.text.strip()

    # Job title regex — run over bio first (cleaner signal), then post
    for pattern in _JOB_TITLE_PATTERNS:
        m = pattern.search(combined)
        if m:
            # Use group(1) if the pattern captured a named group, else full match
            job_title = (m.group(1) if m.lastindex else m.group(0)).strip()
            break

    return EntityExtractionResponse(
        name=name,
        company=company,
        location=location,
        job_title=job_title,
    )
