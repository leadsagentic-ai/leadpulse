"""Shared fixtures and environment setup for all ML service tests."""
import os

# Set required env vars before any test module imports main.py (which runs
# settings = Settings() at module level).
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test-placeholder-key")
os.environ.setdefault("ML_SERVICE_SECRET", "test-shared-secret-for-pytest-only")
