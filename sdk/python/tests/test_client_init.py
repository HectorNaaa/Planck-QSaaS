import pytest

from planck_sdk.client import PlanckUser
from planck_sdk.exceptions import AuthenticationError, ValidationError
from planck_sdk import get_install_command, get_notebook_install_code


class TestPlanckUserInit:
    def test_valid_api_key(self):
        user = PlanckUser(api_key="sk_live_abc123DEF")
        assert user.api_key == "sk_live_abc123DEF"
        assert user.base_url == "https://plancktechnologies.xyz"
        assert user.timeout == 60

    def test_custom_base_url(self):
        user = PlanckUser(api_key="valid_key_1234", base_url="http://localhost:3000")
        assert user.base_url == "http://localhost:3000"

    def test_custom_timeout(self):
        user = PlanckUser(api_key="valid_key_1234", timeout=120)
        assert user.timeout == 120

    def test_empty_api_key_raises(self):
        with pytest.raises(AuthenticationError, match="API key is required"):
            PlanckUser(api_key="")

    def test_none_api_key_raises(self):
        with pytest.raises(AuthenticationError, match="API key is required"):
            PlanckUser(api_key=None)  # type: ignore

    def test_short_api_key_raises(self):
        with pytest.raises(AuthenticationError, match="Invalid API key format"):
            PlanckUser(api_key="short")

    def test_key_with_special_chars_raises(self):
        with pytest.raises(AuthenticationError, match="Invalid API key format"):
            PlanckUser(api_key="key-with@sym&ols!")

    def test_base_url_strips_trailing_slash(self):
        user = PlanckUser(api_key="valid_key_1234", base_url="https://plancktechnologies.xyz/")
        assert user.base_url == "https://plancktechnologies.xyz"


class TestValidateApiKey:
    def test_valid_key(self):
        assert PlanckUser._validate_api_key("sk_live_abc123DEF") is True

    def test_empty_key(self):
        assert PlanckUser._validate_api_key("") is False

    def test_short_key(self):
        assert PlanckUser._validate_api_key("abc") is False

    def test_long_key(self):
        assert PlanckUser._validate_api_key("a" * 201) is False

    def test_key_with_spaces(self):
        assert PlanckUser._validate_api_key("key with spaces") is False

    def test_key_with_special_chars(self):
        assert PlanckUser._validate_api_key("key@#$%") is False


class TestSanitizeString:
    def test_html_escaping(self):
        result = PlanckUser._sanitize_string("<script>alert('xss')</script>")
        assert "<script>" not in result
        assert "&lt;script&gt;" in result

    def test_truncation(self):
        result = PlanckUser._sanitize_string("a" * 2000, max_length=10)
        assert len(result) == 10

    def test_non_string_input(self):
        result = PlanckUser._sanitize_string(12345, max_length=10)
        assert isinstance(result, str)
        assert result == "12345"

    def test_empty_string(self):
        result = PlanckUser._sanitize_string("")
        assert result == ""


class TestValidateAlgorithm:
    def test_valid_algorithms(self):
        for algo in ["vqe", "grover", "qaoa", "qft", "bell", "shor"]:
            assert PlanckUser._validate_algorithm(algo) == algo

    def test_case_insensitive(self):
        assert PlanckUser._validate_algorithm("VQE") == "vqe"
        assert PlanckUser._validate_algorithm("Grover") == "grover"

    def test_whitespace_stripped(self):
        assert PlanckUser._validate_algorithm("  vqe  ") == "vqe"

    def test_unknown_algorithm_defaults(self):
        assert PlanckUser._validate_algorithm("unknown") == "vqe"

    def test_empty_algorithm_defaults(self):
        assert PlanckUser._validate_algorithm("") == "vqe"


class TestModuleFunctions:
    def test_get_install_command(self):
        result = get_install_command()
        assert result == "pip install planck_sdk"

    def test_get_notebook_install_code(self):
        result = get_notebook_install_code()
        assert "pip install" in result
        assert "Planck SDK installed" in result
