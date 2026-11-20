"""AI Engine configuration settings."""

import os
from decimal import Decimal

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "")

WHISPER_ENABLED = os.getenv("WHISPER_ENABLED", "false").lower() == "true"
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "small")

SCALE_MATCH_G = Decimal(os.getenv("SCALE_MATCH_G", "0.01"))
