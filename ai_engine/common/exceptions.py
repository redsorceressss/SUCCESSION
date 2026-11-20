"""Exceptions for AI/ML and Agent modules."""

class AIEngineError(Exception):
    """Base exception for all AI/ML operations."""
    pass

class AgentPermissionError(AIEngineError):
    """Raised when the agent attempts a forbidden action."""
    pass

class UnreadableScaleError(AIEngineError):
    """Raised when OCR cannot confidently decode display digits."""
    pass

class LLMValidationError(AIEngineError):
    """Raised when LLM output fails schema validation."""
    pass
