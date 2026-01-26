"""
Planck SDK - Exception classes
"""


class PlanckError(Exception):
    """Base exception for all Planck SDK errors."""
    pass


class AuthenticationError(PlanckError):
    """Raised when API authentication fails."""
    pass


class CircuitError(PlanckError):
    """Raised when circuit generation or execution fails."""
    pass


class APIError(PlanckError):
    """Raised when API request fails."""
    pass


class ValidationError(PlanckError):
    """Raised when input validation fails."""
    pass


class RateLimitError(APIError):
    """Raised when rate limit is exceeded."""
    pass


class PayloadTooLargeError(APIError):
    """Raised when request payload exceeds size limit."""
    pass


class TimeoutError(PlanckError):
    """Raised when request times out."""
    pass
