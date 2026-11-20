"""Optional LLM helper with strict validation and a safe fallback.
Works with any provider that offers an OpenAI-compatible /chat/completions endpoint.
Set LLM_BASE_URL, LLM_API_KEY, LLM_MODEL in .env.
If anything goes wrong (no key, timeout, bad JSON, failed validation), return None
and the caller uses its deterministic template or rule-based parser instead.
"""

import json
import os
import httpx
from pydantic import BaseModel, ValidationError

class LLMClient:
    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        transport: httpx.BaseTransport | None = None,
        timeout: float | httpx.Timeout | None = None,
    ):
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", "")).rstrip("/")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("LLM_MODEL", "")
        # Safe default timeout for optional external LLM calls; callers rely on
        # deterministic local fallbacks when unavailable or failing.
        if timeout is None:
            timeout = httpx.Timeout(10.0, connect=5.0)
        self._http = httpx.Client(transport=transport, timeout=timeout)

    @property
    def available(self) -> bool:
        has_mock = (
            hasattr(self._http, "_transport")
            and self._http._transport is not None
            and self._http._transport.__class__.__name__ == "MockTransport"
        )
        return bool(self.base_url and self.model and (self.api_key or has_mock))

    def complete_text(self, system: str, user: str) -> str | None:
        if not self.available:
            return None
        headers = {}
        # Never log or expose credentials; include auth header only when configured.
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        try:
            r = self._http.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json={
                    "model": self.model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            r.raise_for_status()
            data = r.json()
            choices = data.get("choices") or []
            if not choices:
                return None
            message = choices[0].get("message") or {}
            content = message.get("content")
            return content if isinstance(content, str) else None
        except Exception:
            # Provider/network/timeout/parse errors must fail closed to local fallback.
            return None

    def complete_json(self, system: str, user: str, model_cls: type[BaseModel]) -> BaseModel | None:
        """Ask for JSON, then VALIDATE it. Never trust the model's output shape or values."""
        raw = self.complete_text(
            system + "\nReply with one JSON object only, no prose.", user
        )
        if raw is None:
            return None
        try:
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return model_cls.model_validate(json.loads(raw))
        except (json.JSONDecodeError, ValidationError):
            return None
