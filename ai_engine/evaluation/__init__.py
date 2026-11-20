"""AI evaluation benchmark package."""

from .voice_eval import run_voice_eval
from .ocr_eval import run_ocr_eval, render_synthetic_digit_image

__all__ = ["run_voice_eval", "run_ocr_eval", "render_synthetic_digit_image"]
