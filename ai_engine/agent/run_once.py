"""Run the agent once. Use Windows Task Scheduler (or cron) to call this every 15-30 minutes:
    python -m ai_engine.agent.run_once
Needs in .env: API_BASE_URL (default http://127.0.0.1:8000), AGENT_LOGIN, AGENT_PASSWORD.
"""

import os
import httpx
from .gateway import Gateway
from .workflows import run_once

def main():
    base = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
    login = os.getenv("AGENT_LOGIN", "agent1")
    password = os.getenv("AGENT_PASSWORD", "agent-password-dev-only")

    with httpx.Client(base_url=base, timeout=20) as client:
        r = client.post(
            "/auth/login",
            json={"login": login, "password": password},
        )
        r.raise_for_status()
        client.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
        counts = run_once(Gateway(client))
        print("Agent pass completed:", counts)

if __name__ == "__main__":
    main()
