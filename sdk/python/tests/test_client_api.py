import json
from unittest.mock import patch

import pytest

from planck_sdk.client import PlanckUser
from planck_sdk.exceptions import APIError, AuthenticationError, CircuitError, ValidationError


@pytest.fixture
def user():
    return PlanckUser(api_key="sk_valid_key_12345")


def mock_urlopen_factory(response_data: dict, status: int = 200, headers=None):
    from unittest.mock import MagicMock

    payload = json.dumps(response_data).encode("utf-8")
    mock_response = MagicMock()
    mock_response.read.return_value = payload
    mock_response.__enter__.return_value = mock_response
    mock_response.status = status
    mock_response.headers = headers or {}
    return mock_response


class TestHealthCheck:
    @patch("planck_sdk.client.urlopen")
    def test_health_check_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True, "status": "ok"})
        result = user.health_check()
        assert result["success"] is True
        assert result["status"] == "ok"

    @patch("planck_sdk.client.urlopen")
    def test_health_check_failure(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": False})
        result = user.health_check()
        assert result["success"] is False


class TestPing:
    @patch("planck_sdk.client.urlopen")
    def test_ping_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True})
        assert user.ping() is True

    @patch("planck_sdk.client.urlopen")
    def test_ping_failure_returns_false(self, mock_urlopen, user):
        mock_urlopen.side_effect = Exception("Network error")
        assert user.ping() is False


class TestGetDigitalTwin:
    @patch("planck_sdk.client.urlopen")
    def test_get_digital_twin_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": True,
            "digital_twin": {"insights": "good"},
        })
        result = user.get_digital_twin(
            algorithm="vqe",
            circuit_info={"qubits": 2},
            execution_results={"counts": {"00": 512}},
        )
        assert result == {"insights": "good"}

    @patch("planck_sdk.client.urlopen")
    def test_get_digital_twin_failure(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": False,
            "error": "Digital twin failed",
        })
        with pytest.raises(APIError, match="Digital twin failed"):
            user.get_digital_twin(
                algorithm="vqe",
                circuit_info={"qubits": 2},
                execution_results={"counts": {"00": 512}},
            )


class TestListDigitalTwins:
    @patch("planck_sdk.client.urlopen")
    def test_list_digital_twins_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "digital_twins": [
                {"id": "dt-1", "name": "Twin 1", "description": "desc", "created_at": "2026-01-01"},
                {"id": "dt-2", "name": "Twin 2", "description": None, "created_at": "2026-01-02"},
            ],
        })
        twins = user.list_digital_twins()
        assert len(twins) == 2
        assert twins[0]["name"] == "Twin 1"
        assert twins[1]["description"] is None

    @patch("planck_sdk.client.urlopen")
    def test_list_digital_twins_empty(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({})
        twins = user.list_digital_twins()
        assert twins == []

    @patch("planck_sdk.client.urlopen")
    def test_list_digital_twins_not_a_list(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"digital_twins": "not_a_list"})
        twins = user.list_digital_twins()
        assert twins == []


class TestGetRecommendations:
    @patch("planck_sdk.client.urlopen")
    def test_get_recommendations_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": True,
            "recommendedShots": 2048,
            "recommendedBackend": "hpc_gpu",
            "recommendedErrorMitigation": "high",
            "confidence": 0.9,
            "reasoning": "Large dataset",
            "basedOnExecutions": 10,
        })
        recs = user.get_recommendations(qubits=10, depth=50, gate_count=100,
                                         algorithm="vqe", data_size=5000)
        assert recs["recommended_shots"] == 2048
        assert recs["recommended_backend"] == "hpc_gpu"
        assert recs["confidence"] == 0.9

    @patch("planck_sdk.client.urlopen")
    def test_get_recommendations_values_clamped(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({"success": True})
        recs = user.get_recommendations(qubits=100, depth=5000, gate_count=99999,
                                         algorithm="vqe", data_size=99999)
        assert recs is not None


class TestVisualize:
    @patch("planck_sdk.client.urlopen")
    def test_visualize_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": True,
            "image_data": "<svg>...</svg>",
            "format": "svg",
            "stats": {"gates": 5},
            "width": 800,
            "height": 200,
        })
        result = user.visualize(qasm='qreg q[2];\n')
        assert result["image_data"] == "<svg>...</svg>"
        assert result["format"] == "svg"
        assert result["width"] == 800

    def test_visualize_empty_qasm_raises(self, user):
        with pytest.raises(ValidationError, match="QASM code is required"):
            user.visualize(qasm="")

    @patch("planck_sdk.client.urlopen")
    def test_visualize_failure(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": False,
            "error": "Visualization failed",
        })
        with pytest.raises(CircuitError, match="Visualization failed"):
            user.visualize(qasm='qreg q[2];\n')


class TestListExecutions:
    @patch("urllib.request.urlopen")
    def test_list_executions_defaults(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "executions": [{"id": "exec-1"}],
            "total": 1,
            "limit": 20,
            "offset": 0,
        })
        result = user.list_executions()
        assert len(result["executions"]) == 1
        assert result["total"] == 1

    @patch("urllib.request.urlopen")
    def test_list_executions_with_filters(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "executions": [],
            "total": 0,
            "limit": 50,
            "offset": 10,
        })
        result = user.list_executions(limit=50, offset=10, status="completed")
        assert result["total"] == 0

    @patch("planck_sdk.client.urlopen")
    def test_list_executions_401_raises(self, mock_urlopen, user):
        from urllib.error import HTTPError

        error_body = json.dumps({"error": "Invalid key"}).encode("utf-8")
        mock_urlopen.side_effect = HTTPError(
            url="http://mock",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=None,
        )

        with pytest.raises((AuthenticationError, APIError)):
            user.list_executions()


class TestListExecutionsBranches:
    @patch("urllib.request.urlopen")
    def test_list_executions_non_401_error(self, mock_urlopen, user):
        from urllib.error import HTTPError

        error_body = json.dumps({"error": "server error"}).encode("utf-8")
        mock_urlopen.side_effect = HTTPError(
            url="http://mock",
            code=500,
            msg="Server Error",
            hdrs={},
            fp=None,
        )
        with pytest.raises(APIError, match="API error \\(500\\)"):
            user.list_executions()


class TestListDigitalTwinsBranches:
    @patch("planck_sdk.client.urlopen")
    def test_list_digital_twins_with_data_key(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "data": [{"id": "dt-1", "name": "Twin A"}],
        })
        twins = user.list_digital_twins()
        assert len(twins) == 1
        assert twins[0]["name"] == "Twin A"


class TestGetRecommendationsBranches:
    @patch("planck_sdk.client.urlopen")
    def test_get_recommendations_failure(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": False,
            "error": "Recommendation failed",
        })
        with pytest.raises(APIError, match="Recommendation failed"):
            user.get_recommendations(
                qubits=10, depth=50, gate_count=100,
                algorithm="vqe", data_size=5000
            )


class TestRepr:
    def test_repr(self, user):
        r = repr(user)
        assert "PlanckUser" in r
        assert "plancktechnologies" in r
