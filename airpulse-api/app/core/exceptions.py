from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status


class AirPulseException(HTTPException):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[List[Dict[str, Any]]] = None,
    ):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or []


class EntityNotFoundException(AirPulseException):
    def __init__(self, entity_name: str, identifier: Any):
        super().__init__(
            code="ENTITY_NOT_FOUND",
            message=f"{entity_name} with identifier '{identifier}' was not found.",
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ValidationFailedException(AirPulseException):
    def __init__(self, message: str, details: Optional[List[Dict[str, Any]]] = None):
        super().__init__(
            code="VALIDATION_ERROR",
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details=details,
        )


class UnauthorizedException(AirPulseException):
    def __init__(self, message: str = "Authentication required or token invalid."):
        super().__init__(
            code="UNAUTHORIZED",
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenException(AirPulseException):
    def __init__(self, message: str = "Insufficient permissions to perform this action."):
        super().__init__(
            code="FORBIDDEN",
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
        )


class CollectionFailedException(AirPulseException):
    def __init__(self, source_name: str, reason: str):
        super().__init__(
            code="COLLECTION_FAILED",
            message=f"Collection failed for source '{source_name}': {reason}",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class ScraperError(Exception):
    """Raised by live collectors when a scrape fails at a specific, diagnosable stage.

    Carries the ``ScrapeFailureStage`` so the scraping-test workflow can record exactly
    where collection failed (DNS, connection, timeout, HTTP error, blocked, CAPTCHA,
    empty response, selector-not-found, parse error, no availability, etc.) instead of
    silently degrading to replay/synthetic data.
    """

    def __init__(self, stage, reason: str, http_status: Optional[int] = None):
        # ``stage`` is a ScrapeFailureStage (imported lazily to avoid a cycle).
        self.stage = stage
        self.reason = reason
        self.http_status = http_status
        stage_value = getattr(stage, "value", str(stage))
        super().__init__(f"[{stage_value}] {reason}")
