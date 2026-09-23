"""
Tests for the canonical twin-execution primitive (run_twin) and twin
management methods (create_twin/list_twins/publish_twin/duplicate_twin/
delete_twin), plus the deprecated run_finance_twin() alias and the
quark_optimizer flag on run()/generate_circuit().
"""
import json
import warnings
from unittest.mock import MagicMock, patch

import pytest

from planck_sdk.client import PlanckUser
from planck_sdk.circuit import CircuitBuildOptions
from planck_sdk.exceptions import APIError, ValidationError


@pytest.fixture
def user():
    return PlanckUser(api_key="sk_valid_key_12345")


def mock_urlopen_factory(response_data: dict, status: int = 200):
    payload = json.dumps(response_data).encode("utf-8")
    mock_response = MagicMock()
    mock_response.read.return_value = payload
    mock_response.__enter__.return_value = mock_response
    mock_response.status = status
    mock_response.headers = {}
    return mock_response


def request_body(mock_urlopen) -> dict:
    """Decode the JSON body of the Request passed to the last urlopen() call."""
    req = mock_urlopen.call_args[0][0]
    return json.loads(req.data.decode("utf-8"))


def request_url(mock_urlopen) -> str:
    req = mock_urlopen.call_args[0][0]
    return req.full_url


class TestRunTwinValidation:
    def test_requires_twin_id_or_module_id(self, user):
        with pytest.raises(ValidationError, match="twin_id.*module_id"):
            user.run_twin(use_demo=True)

    def test_rejects_unknown_module(self, user):
        with pytest.raises(ValidationError, match="Unknown finance module"):
            user.run_twin(module_id="not-a-module", use_demo=True)

    def test_requires_snapshot_or_demo(self, user):
        with pytest.raises(ValidationError, match="use_demo"):
            user.run_twin(module_id="risk-scenario")


class TestRunTwinExecution:
    @patch("planck_sdk.client.urlopen")
    def test_ad_hoc_demo_run_hits_module_endpoint(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": True, "run": {"runId": "r1", "executionMode": "classical"}}
        )
        result = user.run_twin(module_id="risk-scenario", use_demo=True, scenario={"horizonDays": 5})
        assert result["runId"] == "r1"
        assert "risk-scenario/run" in request_url(mock_urlopen)
        body = request_body(mock_urlopen)
        # Canonical field name is computeMode, not executionMode/mode/backend.
        assert body["computeMode"] == "classical"
        assert "twinId" not in body

    @patch("planck_sdk.client.urlopen")
    def test_saved_twin_run_sends_twin_id_and_resolves_module(self, mock_urlopen, user):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, "twin": {"id": "t1", "moduleId": "execution-rfq"}}),
            mock_urlopen_factory({"success": True, "run": {"runId": "r2"}}),
        ]
        result = user.run_twin(twin_id="t1", use_demo=True)
        assert result["runId"] == "r2"
        last_req = mock_urlopen.call_args[0][0]
        assert "execution-rfq/run" in last_req.full_url
        body = json.loads(last_req.data.decode("utf-8"))
        assert body["twinId"] == "t1"

    @patch("planck_sdk.client.urlopen")
    def test_quantum_inspired_compute_mode_forwarded(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "run": {"runId": "r3"}})
        user.run_twin(module_id="collateral-liquidity", use_demo=True, compute_mode="quantum-inspired")
        assert request_body(mock_urlopen)["computeMode"] == "quantum-inspired"

    @patch("planck_sdk.client.urlopen")
    def test_run_failure_raises_api_error(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": False, "error": "boom"})
        with pytest.raises(APIError, match="boom"):
            user.run_twin(module_id="risk-scenario", use_demo=True)


class TestRunFinanceTwinDeprecatedAlias:
    @patch("planck_sdk.client.urlopen")
    def test_delegates_to_run_twin_with_same_behavior(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "run": {"runId": "r4"}})
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            result = user.run_finance_twin(module_id="risk-scenario", scenario={}, use_demo=True)
        assert result["runId"] == "r4"
        assert any(issubclass(w.category, DeprecationWarning) for w in caught)
        assert request_body(mock_urlopen)["computeMode"] == "classical"


class TestTwinManagement:
    @patch("planck_sdk.client.urlopen")
    def test_create_twin(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": True, "twin": {"id": "t9", "visibility": "private"}}
        )
        twin = user.create_twin(module_id="risk-scenario", name="My Twin")
        assert twin["id"] == "t9"
        assert request_body(mock_urlopen)["visibility"] == "private"

    @patch("planck_sdk.client.urlopen")
    def test_create_twin_rejects_unknown_module(self, mock_urlopen, user):
        with pytest.raises(ValidationError):
            user.create_twin(module_id="bogus", name="x")
        mock_urlopen.assert_not_called()

    @patch("planck_sdk.client.urlopen")
    def test_list_twins_scope_public_query_string(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "twins": [{"id": "t1"}]})
        twins = user.list_twins(scope="public", tag="finance")
        assert twins == [{"id": "t1"}]
        url = request_url(mock_urlopen)
        assert "scope=public" in url and "tag=finance" in url

    def test_list_twins_rejects_bad_scope(self, user):
        with pytest.raises(ValidationError):
            user.list_twins(scope="everyone")

    @patch("planck_sdk.client.urlopen")
    def test_publish_and_unpublish_twin(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "twin": {"visibility": "public"}})
        user.publish_twin("t1")
        assert request_body(mock_urlopen)["visibility"] == "public"

        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "twin": {"visibility": "private"}})
        user.unpublish_twin("t1")
        assert request_body(mock_urlopen)["visibility"] == "private"

    @patch("planck_sdk.client.urlopen")
    def test_duplicate_twin(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "twin": {"id": "copy-1"}})
        twin = user.duplicate_twin("pub-1")
        assert twin["id"] == "copy-1"
        assert "pub-1/duplicate" in request_url(mock_urlopen)

    @patch("planck_sdk.client.urlopen")
    def test_delete_twin(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True})
        assert user.delete_twin("t1") is True


class TestQuarkOptimizerFlag:
    @patch("planck_sdk.client.urlopen")
    def test_generate_circuit_explicit_build_options_sends_quark_flag(self, mock_urlopen, user, sample_circuit_response):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, **sample_circuit_response})
        user.generate_circuit(data=[1, 2, 3], algorithm="vqe", build_options=CircuitBuildOptions())
        assert request_body(mock_urlopen)["quarkOptimizer"] is True

    @patch("planck_sdk.client.urlopen")
    def test_run_quark_optimizer_disabled(self, mock_urlopen, user, sample_circuit_response, sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        user.run(data=[1, 2, 3], algorithm="vqe", quark_optimizer=0)
        first_req = mock_urlopen.call_args_list[0][0][0]
        body = json.loads(first_req.data.decode("utf-8"))
        assert body["quarkOptimizer"] is False

    @patch("planck_sdk.client.urlopen")
    def test_run_quark_optimizer_default_enabled(self, mock_urlopen, user, sample_circuit_response, sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        user.run(data=[1, 2, 3], algorithm="vqe")
        first_req = mock_urlopen.call_args_list[0][0][0]
        body = json.loads(first_req.data.decode("utf-8"))
        assert body["quarkOptimizer"] is True
