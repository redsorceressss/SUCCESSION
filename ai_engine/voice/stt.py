"""Speech to text (Optional server-side faster-whisper).
Lazy model loading, CPU-compatible configuration, no download on startup.
If faster-whisper is not installed, degrades gracefully.
"""

from functools import lru_cache

@lru_cache(maxsize=1)
def _model(size: str = "small"):
    from faster_whisper import WhisperModel
    return WhisperModel(size, device="cpu", compute_type="int8")

def transcribe(audio_path: str, language: str | None = None) -> str:
    """Transcribes audio file to text.
    language: 'en', 'hi', 'kn' or None for auto-detection.
    """
    try:
        segments, _info = _model().transcribe(audio_path, language=language, vad_filter=True)
        return " ".join(seg.text.strip() for seg in segments).strip()
    except ImportError:
        raise RuntimeError("faster-whisper is not installed. Use Web Speech API or install faster-whisper.")
    except Exception as e:
        raise RuntimeError(f"Speech transcription failed: {e}")
