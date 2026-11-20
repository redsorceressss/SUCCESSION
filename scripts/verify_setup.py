"""Environment and setup verification script for Windows & VS Code."""

import sys
from decimal import Decimal
from pathlib import Path

# Ensure repo root is on sys.path
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def verify():
    print("--- 1. Python Version Check ---")
    print(f"Python: {sys.version}")
    if sys.version_info < (3, 11):
        print("ERROR: Python 3.11+ is required.")
        sys.exit(1)
    print("OK: Python version supported.")

    print("\n--- 2. Exact Decimal Arithmetic Verification ---")
    a = Decimal("50.00")
    b = Decimal("49.85")
    diff = a - b
    assert diff == Decimal("0.15"), "Decimal arithmetic failed!"
    assert str(diff) == "0.15", "Decimal string formatting failed!"
    print(f"OK: 50.00 - 49.85 = {diff} (exact Decimal)")

    print("\n--- 3. Package Imports Check ---")
    required = [
        ("fastapi", "FastAPI"),
        ("sqlalchemy", "SQLAlchemy"),
        ("pydantic", "Pydantic v2"),
        ("jwt", "PyJWT"),
        ("cv2", "OpenCV"),
        ("apscheduler", "APScheduler"),
        ("pytest", "Pytest"),
        ("httpx", "HTTPX"),
    ]
    for mod, label in required:
        try:
            __import__(mod)
            print(f"OK: {label} loaded successfully.")
        except ImportError as e:
            print(f"ERROR: Failed to import {label}: {e}")
            sys.exit(1)

    print("\n--- 4. Backend & Core Engine Imports ---")
    try:
        from core_engine.purity import fine_gold
        from core_engine.conservation import reconcile
        from backend.app.main import app
        from ai_engine.voice.parse_rules import parse_entry
        from ai_engine.ocr.seven_segment import decode
        print("OK: Core Engine, AI Engine, and FastAPI app imported cleanly without circular errors.")
    except Exception as e:
        print(f"ERROR during internal module import: {e}")
        sys.exit(1)

    print("\n==========================================")
    print("ALL ENVIRONMENT CHECKS PASSED SUCCESSFULLY!")
    print("==========================================")

if __name__ == "__main__":
    verify()
