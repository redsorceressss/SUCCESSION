"""Language handling and localization support for English, Hindi, and Kannada."""

SUPPORTED_LANGUAGES = {"en": "English", "hi": "Hindi", "kn": "Kannada"}

def detect_language_hint(text: str) -> str:
    """Heuristic language detection based on character ranges."""
    for ch in text:
        cp = ord(ch)
        if 0x0900 <= cp <= 0x097F:
            return "hi"
        if 0x0C80 <= cp <= 0x0CFF:
            return "kn"
    return "en"
