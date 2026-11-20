"""Tests for Scale OCR and LLM client wrapper."""

from decimal import Decimal
import httpx
import numpy as np
import pytest
from pydantic import BaseModel

from ai_engine.ocr.seven_segment import decode
from ai_engine.ocr.read_display import read_display_image
from ai_engine.ocr.compare import compare_weights
from ai_engine.evaluation.ocr_eval import render_synthetic_digit_image
from ai_engine.llm import LLMClient

def test_ocr_synthetic_image_reading():
    # Render synthetic scale display with green 7-segment 50.00
    img = render_synthetic_digit_image("50.00")
    decoded = decode(img)
    assert decoded == "50.00"

def test_ocr_lcd_display_decoding():
    # Render synthetic scale display with LCD dark-on-grey style
    img_lcd = render_synthetic_digit_image("49.85", style="lcd_dark_on_grey")
    decoded = decode(img_lcd)
    assert decoded == "49.85"

def test_ocr_glare_abstention():
    # Specular glare must result in UNREADABLE abstention rather than fabricated weight
    img_glare = render_synthetic_digit_image("50.00", add_glare=True)
    reading = read_display_image(img_glare)
    assert reading.status == "UNREADABLE"
    assert reading.value is None

def test_ocr_read_display_pipeline():
    img = render_synthetic_digit_image("50.00")
    reading = read_display_image(img)
    assert reading.status == "READABLE"
    assert reading.value == Decimal("50.00")
    assert reading.confidence >= 0.70

def test_ocr_unreadable():

    # Blank or noise image
    blank = np.zeros((100, 200, 3), dtype=np.uint8)
    assert decode(blank) is None

    # Compare unreadable
    status = compare_weights(None, Decimal("50.00"))
    assert status == "UNREADABLE"

def test_ocr_compare_match_and_mismatch():
    assert compare_weights(Decimal("50.00"), Decimal("50.00")) == "MATCH"
    assert compare_weights(Decimal("50.005"), Decimal("50.00"), tolerance=Decimal("0.01")) == "MATCH"
    assert compare_weights(Decimal("49.85"), Decimal("50.00")) == "MISMATCH"

class SampleSchema(BaseModel):
    karigar: str
    weight: str

def test_llm_client_mock():
    # Test LLM with MockTransport
    def handler(request: httpx.Request):
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": '```json\n{"karigar": "Ramesh", "weight": "50.00"}\n```'}}
                ]
            },
        )

    transport = httpx.MockTransport(handler)
    client = LLMClient(
        base_url="https://mock.llm/api",
        api_key="mock-key",
        model="gpt-test",
        transport=transport,
    )
    assert client.available is True

    parsed = client.complete_json("system", "prompt", SampleSchema)
    assert parsed is not None
    assert parsed.karigar == "Ramesh"
    assert parsed.weight == "50.00"

def test_llm_client_fallback_on_invalid_json():
    def bad_handler(request: httpx.Request):
        return httpx.Response(200, json={"choices": [{"message": {"content": "not valid json"}}]})

    transport = httpx.MockTransport(bad_handler)
    client = LLMClient(
        base_url="https://mock.llm/api",
        api_key="mock-key",
        model="gpt-test",
        transport=transport,
    )
    parsed = client.complete_json("system", "prompt", SampleSchema)
    assert parsed is None
