import json
from unittest.mock import MagicMock, patch
from collections import namedtuple
from typing import Any, Dict, Optional
from urllib.error import HTTPError

import pytest

from planck_sdk.circuit import QuantumCircuit


# ─── Factories ─────────────────────────────────────────────────────────────────

def make_mock_response(
    status: int = 200,
    body: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> MagicMock:
    """Build a mock `http.client.HTTPResponse`-like object."""
    if body is None:
        body = {"success": True, "execution_id": "mock-exec-001"}
    data = json.dumps(body).encode("utf-8")
    mock_resp = MagicMock()
    mock_resp.read.return_value = data
    mock_resp.__enter__.return_value = mock_resp
    mock_resp.status = status
    if headers:
        mock_resp.headers = headers
    else:
        mock_resp.headers = {}
    return mock_resp


def make_mock_http_error(
    status: int = 400,
    body: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> HTTPError:
    """Build a fake `urllib.error.HTTPError`."""
    if body is None:
        body = {"error": "mock error"}
    data = json.dumps(body).encode("utf-8")
    # HTTPError(url, code, msg, hdrs, fp)
    return HTTPError(
        url="http://mock/api/quantum/test",
        code=status,
        msg="mock error",
        hdrs=headers or {},
        fp=MagicMock() if False else None,
    )


@pytest.fixture
def sample_circuit_response() -> Dict[str, Any]:
    return {
        "qasm": 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\nh q[0];\ncx q[0],q[1];',
        "qubits": 2,
        "depth": 3,
        "gate_count": 4,
        "gates": ["h", "cx"],
        "algorithm": "vqe",
        "recommended_shots": 1024,
        "param_summary": "2 layers, angle_scale=1.0",
        "transpiled": True,
        "data_scale": "small",
        "layers": 1,
    }


@pytest.fixture
def sample_circuit(sample_circuit_response) -> QuantumCircuit:
    return QuantumCircuit.from_api_response(sample_circuit_response)


@pytest.fixture
def sample_execution_response() -> Dict[str, Any]:
    return {
        "success": True,
        "execution_id": "exec-abc-123",
        "counts": {"00": 512, "11": 512},
        "successRate": 98.5,
        "runtime": 42.0,
        "backend": "quantum_inspired_gpu",
        "total_shots": 1024,
        "backendReason": "Latency-first: selected quantum_inspired_gpu",
        "backendHint": None,
        "error_mitigation": "low",
        "ml_tuning": {"confidence": 0.82, "reasoning": "Low qubit count"},
    }
