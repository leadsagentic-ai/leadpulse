from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic_settings import BaseSettings

from src.intent.classifier import (
    IntentClassificationRequest,
    IntentClassificationResponse,
    classify_post_intent,
    AnthropicDep,
)


class Settings(BaseSettings):
    ANTHROPIC_API_KEY: str
    ML_SERVICE_SECRET: str
    PORT: int = 8000

    model_config = {"env_file": ".env"}


settings = Settings()
security = HTTPBearer()


def verify_internal_secret(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> None:
    """Verify the shared secret sent by the Cloudflare Workers API."""
    if credentials.credentials != settings.ML_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid service secret")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: load spaCy model into app state
    import spacy  # noqa: PLC0415
    app.state.nlp = spacy.load("en_core_web_sm")  # Phase 1 — upgrade to trf in Phase 2
    yield
    # Shutdown: cleanup (nothing needed currently)


app = FastAPI(
    title="LeadPulse ML Service",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None,        # Disable public Swagger in production
    redoc_url=None,
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "leadpulse-ml"}


@app.post(
    "/classify",
    response_model=IntentClassificationResponse,
    dependencies=[Security(verify_internal_secret)],
)
async def classify(
    request: IntentClassificationRequest,
    client: AnthropicDep,
) -> IntentClassificationResponse:
    return await classify_post_intent(request, client)
