"""Structured logging for AI/ML modules."""

import logging
import json
from datetime import datetime, timezone

logger = logging.getLogger("ai_engine")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] [%(levelname)s] [AI_ENGINE] %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

def log_event(event_type: str, details: dict):
    msg = json.dumps({"event": event_type, "details": details, "ts": datetime.now(timezone.utc).isoformat()})
    logger.info(msg)
