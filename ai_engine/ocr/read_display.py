"""Read the number shown on a digital scale from a photo.
Simplified and honest: a segment decoder for seven-segment displays.
Returns None whenever it is not sure, triggering manual confirmation.
A photo evidences what the scale showed; it does not certify gold purity.
"""

import re
from dataclasses import dataclass
from decimal import Decimal
import numpy as np

_PATTERN = re.compile(r"^\d{1,4}(\.\d{1,3})?$")

@dataclass
class Reading:
    value: Decimal | None
    method: str = "seven_segment"
    raw: str = ""
    confidence: float = 1.0
    status: str = "READABLE"

def read_display_image(img_bgr: np.ndarray) -> Reading:
    """Reads digital scale from in-memory BGR image with preprocessing and confidence abstention."""
    from .preprocess import preprocess_scale_image, detect_glare
    from .confidence import evaluate_reading_confidence
    from .seven_segment import decode

    if img_bgr is None or img_bgr.size == 0:
        return Reading(None, "invalid_image", status="UNREADABLE", confidence=0.0)

    glare = detect_glare(img_bgr)
    if glare > 0.35:
        # Severe glare blinding display
        return Reading(None, "seven_segment", raw="", confidence=0.1, status="UNREADABLE")

    preprocessed = preprocess_scale_image(img_bgr)
    text = decode(preprocessed)

    if not text:
        # Try decoding original if deskew/preprocessing altered subtle segments
        text = decode(img_bgr)

    if text and _PATTERN.match(text):
        conf = evaluate_reading_confidence(text, raw_pattern_score=0.95, glare_ratio=glare)
        if conf >= 0.70:
            return Reading(Decimal(text), "seven_segment", raw=text, confidence=conf, status="READABLE")

    raw_val = text or ""
    return Reading(None, "seven_segment", raw=raw_val, confidence=0.2, status="UNREADABLE")

def read_display(path: str) -> Reading:
    try:
        import cv2
    except ImportError:
        return Reading(None, "unavailable", status="UNREADABLE", confidence=0.0)

    img = cv2.imread(path)
    if img is None:
        return Reading(None, "file_error", status="UNREADABLE", confidence=0.0)

    return read_display_image(img)

