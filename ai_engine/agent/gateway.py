"""The ONLY door from the agent to the backend. It exposes read, remind, draft and log, nothing else."""

import httpx
from .permissions import check

class Gateway:
    def __init__(self, client: httpx.Client):
        self._c = client  # already logged in with the agent token

    def _get(self, path, **params):
        r = self._c.get(path, params=params or None)
        r.raise_for_status()
        return r.json()

    def orders(self):
        check("read")
        return self._get("/agent/orders")

    def disputes(self):
        check("read")
        return self._get("/agent/disputes")

    def dispute(self, dispute_id: int):
        check("read")
        return self._get(f"/disputes/{dispute_id}")

    def settlements(self, order_id: int):
        check("read")
        return self._get("/settlements", order_id=order_id)

    def draft_settlement(self, order_id: int):
        check("draft_settlement")
        r = self._c.post("/settlements", json={"order_id": order_id})
        r.raise_for_status()
        return r.json()

    def notify(self, user_id: int, kind: str, message: str, dedupe_key: str | None = None):
        check("remind")
        r = self._c.post(
            "/agent/notifications",
            json={"user_id": user_id, "kind": kind, "message": message, "dedupe_key": dedupe_key},
        )
        r.raise_for_status()
        return r.json()

    def log_task(self, kind: str, order_id: int | None, summary: str):
        check("log")
        r = self._c.post(
            "/agent/tasks",
            json={"kind": kind, "order_id": order_id, "summary": summary},
        )
        r.raise_for_status()
        return r.json()
