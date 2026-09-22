import json
from unittest.mock import patch

import pytest

from planck_sdk.client import PlanckUser
from planck_sdk.circuit import CircuitBuildOptions, QuantumCircuit
from planck_sdk.exceptions import CircuitError, AuthenticationError, APIError, ValidationError


@pytest.fixture
def user():
    return PlanckUser(api_key="sk_valid_key_12345")


def mock_urlopen_factory(response_data: dict, status: int = 200):
    """Return a urlopen mock that yields a controlled response."""
    from unittest.mock import MagicMock

    payload = json.dumps(response_data).encode("utf-8")
    mock_response = MagicMock()
    mock_response.read.return_value = payload
    mock_response.__enter__.return_value = mock_response
    mock_response.status = status
    mock_response.headers = {}
    return mock_response


class TestGenerateCircuit:
    @patch("planck_sdk.client.urlopen")
    def test_generate_success(self, mock_urlopen, user, sample_circuit_response):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": True, **sample_circuit_response}
        )

        circuit = user.generate_circuit(data=[1, 2, 3], algorithm="vqe")
        assert isinstance(circuit, QuantumCircuit)
        assert circuit.algorithm == "vqe"
        assert circuit.qubits == 2

    @patch("planck_sdk.client.urlopen")
    def test_generate_with_qubits_clamped(self, mock_urlopen, user, sample_circuit_response):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": True, **sample_circuit_response}
        )
        circuit = user.generate_circuit(data=[1], algorithm="vqe", qubits=50)
        assert circuit.qubits == 2

    @patch("planck_sdk.client.urlopen")
    def test_generate_with_build_options(self, mock_urlopen, user, sample_circuit_response):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": True, **sample_circuit_response}
        )
        opts = CircuitBuildOptions(max_qubits=8, angle_scale=0.5)
        circuit = user.generate_circuit(data=[1], algorithm="vqe", build_options=opts)
        assert isinstance(circuit, QuantumCircuit)

    @patch("planck_sdk.client.urlopen")
    def test_generate_failure_raises(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": False, "error": "Generation error"}
        )
        with pytest.raises(CircuitError, match="Generation error"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_generate_http_error(self, mock_urlopen, user):
        from urllib.error import HTTPError

        mock_urlopen.side_effect = HTTPError(
            url="http://mock",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=None,
        )

        with pytest.raises((CircuitError, APIError)):
            user.generate_circuit(data=[1], algorithm="vqe")


class TestSimulate:
    @patch("planck_sdk.client.urlopen")
    def test_simulate_success(self, mock_urlopen, user, sample_execution_response):
        mock_urlopen.return_value = mock_urlopen_factory(sample_execution_response)

        result = user.simulate(
            qasm='OPENQASM 2.0;\nqreg q[2];\n',
            shots=2048,
            backend="quantum_inspired_gpu",
        )
        assert result.execution_id == "exec-abc-123"
        assert result.counts == {"00": 512, "11": 512}
        assert result.backend == "quantum_inspired_gpu"
        assert result.shots == 1024

    @patch("planck_sdk.client.urlopen")
    def test_simulate_algorithm_fallback(self, mock_urlopen, user, sample_execution_response):
        mock_urlopen.return_value = mock_urlopen_factory(sample_execution_response)
        result = user.simulate(qasm='qreg q[2];\n', algorithm="UNKNOWN")
        assert result.algorithm == "vqe"

    @patch("planck_sdk.client.urlopen")
    def test_simulate_backend_fallback(self, mock_urlopen, user, sample_execution_response):
        mock_urlopen.return_value = mock_urlopen_factory(sample_execution_response)
        result = user.simulate(qasm='qreg q[2];\n', backend="invalid_backend")
        assert result.backend == "quantum_inspired_gpu"

    @patch("planck_sdk.client.urlopen")
    def test_simulate_shots_clamped(self, mock_urlopen, user, sample_execution_response):
        mock_urlopen.return_value = mock_urlopen_factory(sample_execution_response)
        result = user.simulate(qasm='qreg q[2];\n', shots=200_000)
        assert result.shots == 1024

    def test_simulate_empty_qasm_raises(self, user):
        with pytest.raises(ValidationError, match="QASM code is required"):
            user.simulate(qasm="")

    def test_simulate_none_qasm_raises(self, user):
        with pytest.raises(ValidationError, match="QASM code is required"):
            user.simulate(qasm=None)

    @patch("planck_sdk.client.urlopen")
    def test_simulate_failure_raises(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": False, "error": "Simulation failed"}
        )
        with pytest.raises(CircuitError, match="Simulation failed"):
            user.simulate(qasm='qreg q[2];\n')

    @patch("planck_sdk.client.urlopen")
    def test_simulate_with_circuit_name(self, mock_urlopen, user, sample_execution_response):
        mock_urlopen.return_value = mock_urlopen_factory(sample_execution_response)
        result = user.simulate(qasm='qreg q[2];\n', circuit_name="My Test")
        assert result.execution_id == "exec-abc-123"


class TestRun:
    @patch("planck_sdk.client.urlopen")
    def test_run_success(self, mock_urlopen, user, sample_circuit_response,
                         sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {"insights": "good"}}),
        ]

        result = user.run(data=[1, 2, 3], algorithm="vqe")
        assert result.execution_id == "exec-abc-123"
        assert result.counts == {"00": 512, "11": 512}

    @patch("planck_sdk.client.urlopen")
    def test_run_with_digital_twin_id(self, mock_urlopen, user, sample_circuit_response,
                                      sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]

        result = user.run(data=[1], digital_twin_id="dt-001")
        assert result.execution_id == "exec-abc-123"

    @patch("planck_sdk.client.urlopen")
    def test_run_digital_twin_failure_does_not_block(self, mock_urlopen, user,
                                                     sample_circuit_response,
                                                     sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            Exception("Digital twin failed"),
        ]

        result = user.run(data=[1], algorithm="vqe")
        assert result.execution_id == "exec-abc-123"

    @patch("planck_sdk.client.urlopen")
    def test_run_digital_twin_id_none_normalization(self, mock_urlopen, user,
                                                    sample_circuit_response,
                                                    sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]

        result = user.run(data=[1], digital_twin_id="none", wait=False)
        assert result.backend is not None

    @patch("planck_sdk.client.urlopen")
    def test_run_failure_raises(self, mock_urlopen, user, sample_circuit_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory({"success": False, "error": "Execution failed"}),
        ]

        with pytest.raises(CircuitError, match="Execution failed"):
            user.run(data=[1, 2, 3], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_run_invalid_backend_fallback(self, mock_urlopen, user, sample_circuit_response,
                                          sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]

        result = user.run(data=[1], backend="invalid_backend")
        assert result.backend is not None


class TestTranspile:
    @patch("planck_sdk.client.urlopen")
    def test_transpile_success(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": True,
            "transpiledQASM": "new_qasm",
            "swapCount": 2,
            "mappedQubits": [0, 1],
            "depth": 5,
        })
        result = user.transpile(qasm='qreg q[2];\n', backend="quantum_qpu")
        assert result["transpiled_qasm"] == "new_qasm"
        assert result["swap_count"] == 2

    def test_transpile_empty_qasm_raises(self, user):
        with pytest.raises(ValidationError, match="QASM code is required"):
            user.transpile(qasm="")

    @patch("planck_sdk.client.urlopen")
    def test_transpile_failure(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory(
            {"success": False, "error": "Transpile error"}
        )
        with pytest.raises(CircuitError, match="Transpile error"):
            user.transpile(qasm='qreg q[2];\n')


class TestRequestErrorHandling:
    @patch("planck_sdk.client.urlopen")
    def test_payload_too_large(self, mock_urlopen, user):
        data = {"x": "y" * (1024 * 1024)}
        with pytest.raises(APIError, match="exceeds maximum allowed size"):
            user.generate_circuit(data=data, algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_http_400_error(self, mock_urlopen, user):
        from urllib.error import HTTPError
        from unittest.mock import MagicMock

        mock_fp = MagicMock()
        mock_fp.read.return_value = json.dumps({"error": "bad request"}).encode("utf-8")
        mock_urlopen.side_effect = HTTPError(
            url="http://mock/circuit", code=400, msg="Bad Request", hdrs={}, fp=mock_fp
        )
        with pytest.raises(CircuitError, match="Invalid request"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_http_401_error(self, mock_urlopen, user):
        from urllib.error import HTTPError
        from unittest.mock import MagicMock

        mock_fp = MagicMock()
        mock_fp.read.return_value = json.dumps({"error": "invalid key"}).encode("utf-8")
        mock_urlopen.side_effect = HTTPError(
            url="http://mock/circuit", code=401, msg="Unauthorized", hdrs={}, fp=mock_fp
        )
        with pytest.raises(AuthenticationError, match="invalid key"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_http_error_invalid_json(self, mock_urlopen, user):
        from urllib.error import HTTPError
        from unittest.mock import MagicMock

        mock_fp = MagicMock()
        mock_fp.read.return_value = b"Not a JSON response"
        mock_urlopen.side_effect = HTTPError(
            url="http://mock/circuit", code=500, msg="Server Error", hdrs={}, fp=mock_fp
        )
        with pytest.raises(APIError, match="Not a JSON response"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_http_429_rate_limit(self, mock_urlopen, user):
        from urllib.error import HTTPError

        error_body = json.dumps({"error": "rate limit"}).encode("utf-8")
        err = HTTPError(
            url="http://mock/circuit", code=429, msg="Too Many Requests", hdrs={}, fp=None
        )
        err.headers = {"Retry-After": "5"}
        mock_urlopen.side_effect = err
        with pytest.raises(APIError, match="Rate limit exceeded"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_http_413_payload_too_large(self, mock_urlopen, user):
        from urllib.error import HTTPError

        error_body = json.dumps({"error": "too big"}).encode("utf-8")
        mock_urlopen.side_effect = HTTPError(
            url="http://mock/circuit", code=413, msg="Payload Too Large", hdrs={}, fp=None
        )
        with pytest.raises(APIError, match="Payload too large"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_http_500_error(self, mock_urlopen, user):
        from urllib.error import HTTPError

        error_body = json.dumps({"error": "server error"}).encode("utf-8")
        mock_urlopen.side_effect = HTTPError(
            url="http://mock/circuit", code=500, msg="Server Error", hdrs={}, fp=None
        )
        with pytest.raises(APIError, match="API error \\(500\\)"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_urlerror_connection_error(self, mock_urlopen, user):
        from urllib.error import URLError

        mock_urlopen.side_effect = URLError("Name or service not known")
        with pytest.raises(APIError, match="Connection error"):
            user.generate_circuit(data=[1], algorithm="vqe")

    @patch("planck_sdk.client.urlopen")
    def test_json_decode_error(self, mock_urlopen, user):
        from unittest.mock import MagicMock

        mock_resp = MagicMock()
        mock_resp.read.return_value = b"not json"
        mock_resp.__enter__.return_value = mock_resp
        mock_resp.status = 200
        mock_resp.headers = {}
        mock_urlopen.return_value = mock_resp
        with pytest.raises(APIError, match="Invalid response from server"):
            user.generate_circuit(data=[1], algorithm="vqe")


class TestRunBranches:
    @patch("planck_sdk.client.urlopen")
    def test_run_with_invalid_error_mitigation(self, mock_urlopen, user,
                                                sample_circuit_response,
                                                sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        result = user.run(data=[1], error_mitigation="invalid")
        assert result is not None

    @patch("planck_sdk.client.urlopen")
    def test_run_with_shots_clamping(self, mock_urlopen, user, sample_circuit_response,
                                     sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        result = user.run(data=[1], shots=999999)
        assert result is not None

    @patch("planck_sdk.client.urlopen")
    def test_run_with_qubits_clamping(self, mock_urlopen, user, sample_circuit_response,
                                      sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        result = user.run(data=[1], qubits=99)
        assert result is not None

    @patch("planck_sdk.client.urlopen")
    @patch("planck_sdk.client.PlanckUser._load_data_file")
    def test_run_with_file_path_data(self, mock_load, mock_urlopen, user,
                                     sample_circuit_response, sample_execution_response):
        mock_load.return_value = ([1, 2, 3], 10000)
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        result = user.run(data="/path/to/data.json")
        assert result is not None

    @patch("planck_sdk.client.urlopen")
    def test_run_with_circuit_name_sanitization(self, mock_urlopen, user,
                                                sample_circuit_response,
                                                sample_execution_response):
        mock_urlopen.side_effect = [
            mock_urlopen_factory({"success": True, **sample_circuit_response}),
            mock_urlopen_factory(sample_execution_response),
            mock_urlopen_factory({"success": True, "digital_twin": {}}),
        ]
        result = user.run(data=[1], circuit_name="<script>alert('xss')</script>")
        assert result is not None


class TestSimulateBranches:
    @patch("planck_sdk.client.urlopen")
    def test_simulate_invalid_error_mitigation(self, mock_urlopen, user,
                                               sample_execution_response):
        mock_urlopen.return_value = mock_urlopen_factory(sample_execution_response)
        result = user.simulate(qasm='qreg q[2];\n', error_mitigation="invalid")
        assert result is not None


class TestTranspileBranches:
    @patch("planck_sdk.client.urlopen")
    def test_transpile_with_qubits_clamping(self, mock_urlopen, user):
        mock_urlopen.return_value = mock_urlopen_factory({
            "success": True,
            "transpiledQASM": "new_qasm",
            "swapCount": 0,
            "mappedQubits": [],
            "depth": 0,
        })
        result = user.transpile(qasm='qreg q[2];\n', qubits=99)
        assert result["transpiled_qasm"] == "new_qasm"
