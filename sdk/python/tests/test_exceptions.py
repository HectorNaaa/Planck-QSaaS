import pytest

from planck_sdk.exceptions import (
    PlanckError,
    AuthenticationError,
    CircuitError,
    APIError,
    ValidationError,
    RateLimitError,
    PayloadTooLargeError,
    TimeoutError,
)


class TestExceptionHierarchy:
    def test_planck_error_is_base(self):
        assert issubclass(AuthenticationError, PlanckError)
        assert issubclass(CircuitError, PlanckError)
        assert issubclass(APIError, PlanckError)
        assert issubclass(ValidationError, PlanckError)
        assert issubclass(TimeoutError, PlanckError)

    def test_rate_limit_inherits_api_error(self):
        assert issubclass(RateLimitError, APIError)
        assert issubclass(RateLimitError, PlanckError)

    def test_payload_too_large_inherits_api_error(self):
        assert issubclass(PayloadTooLargeError, APIError)
        assert issubclass(PayloadTooLargeError, PlanckError)

    def test_exceptions_can_be_raised_and_caught(self):
        for exc_cls in [AuthenticationError, CircuitError, APIError,
                        ValidationError, RateLimitError, PayloadTooLargeError,
                        TimeoutError]:
            try:
                raise exc_cls("test message")
            except PlanckError as e:
                assert str(e) == "test message"

    def test_custom_message(self):
        err = ValidationError("Custom input error")
        assert str(err) == "Custom input error"
