import json
import tempfile
from pathlib import Path

import pytest

from planck_sdk.circuit import CircuitBuildOptions, QuantumCircuit


class TestCircuitBuildOptions:
    def test_defaults_omit_none_fields(self):
        opts = CircuitBuildOptions()
        d = opts.to_dict()
        assert d == {}

    def test_max_qubits_appears(self):
        opts = CircuitBuildOptions(max_qubits=8)
        d = opts.to_dict()
        assert d["maxQubits"] == 8

    def test_max_depth_appears(self):
        opts = CircuitBuildOptions(max_depth=50)
        assert opts.to_dict()["maxDepth"] == 50

    def test_angle_scale_omitted_when_one(self):
        opts = CircuitBuildOptions(angle_scale=1.0)
        assert "angleScale" not in opts.to_dict()

    def test_angle_scale_included_when_not_one(self):
        opts = CircuitBuildOptions(angle_scale=0.5)
        assert opts.to_dict()["angleScale"] == 0.5

    def test_force_layers_appears(self):
        opts = CircuitBuildOptions(force_layers=3)
        assert opts.to_dict()["forceLayers"] == 3

    def test_multiple_fields(self):
        opts = CircuitBuildOptions(max_qubits=10, angle_scale=1.2, force_layers=2)
        d = opts.to_dict()
        assert d == {"maxQubits": 10, "angleScale": 1.2, "forceLayers": 2}
        assert "maxDepth" not in d


class TestQuantumCircuitFromApiResponse:
    def test_full_response(self, sample_circuit_response):
        circuit = QuantumCircuit.from_api_response(sample_circuit_response)
        assert circuit.qasm == sample_circuit_response["qasm"]
        assert circuit.qubits == 2
        assert circuit.depth == 3
        assert circuit.gate_count == 4
        assert circuit.gates == ["h", "cx"]
        assert circuit.algorithm == "vqe"
        assert circuit.recommended_shots == 1024
        assert circuit.transpiled is True
        assert circuit.data_scale == "small"
        assert circuit.layers == 1

    def test_minimal_response(self):
        circuit = QuantumCircuit.from_api_response({})
        assert circuit.qasm == ""
        assert circuit.qubits == 2
        assert circuit.depth == 0
        assert circuit.gate_count == 0
        assert circuit.gates == []
        assert circuit.algorithm == "vqe"
        assert circuit.recommended_shots == 1024
        assert circuit.transpiled is False
        assert circuit.data_scale == "small"
        assert circuit.layers == 1

    def test_camel_case_keys(self):
        resp = {
            "qasm": "test",
            "qubits": 4,
            "depth": 10,
            "gateCount": 15,
            "gates": ["h", "cx", "t"],
            "algorithm": "grover",
            "recommendedShots": 2048,
            "paramSummary": "some summary",
            "transpiled": True,
            "dataScale": "medium",
            "layers": 2,
        }
        circuit = QuantumCircuit.from_api_response(resp)
        assert circuit.qubits == 4
        assert circuit.gate_count == 15
        assert circuit.recommended_shots == 2048
        assert circuit.param_summary == "some summary"
        assert circuit.data_scale == "medium"
        assert circuit.layers == 2

    def test_snake_case_takes_precedence(self):
        resp = {
            "qasm": "test",
            "gate_count": 10,
            "gateCount": 99,
            "recommended_shots": 512,
            "recommendedShots": 1024,
        }
        circuit = QuantumCircuit.from_api_response(resp)
        assert circuit.gate_count == 10
        assert circuit.recommended_shots == 512


class TestQuantumCircuitMethods:
    def test_to_dict_roundtrip(self, sample_circuit_response):
        circuit = QuantumCircuit.from_api_response(sample_circuit_response)
        d = circuit.to_dict()
        assert d["qasm"] == sample_circuit_response["qasm"]
        assert d["qubits"] == 2
        assert d["algorithm"] == "vqe"

    def test_to_dict_contains_all_fields(self, sample_circuit):
        d = sample_circuit.to_dict()
        for key in ["qasm", "qubits", "depth", "gate_count", "gates",
                     "algorithm", "recommended_shots", "param_summary",
                     "transpiled", "data_scale", "layers"]:
            assert key in d

    def test_save_writes_qasm_file(self, sample_circuit):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".qasm", delete=False) as f:
            path = f.name
        try:
            sample_circuit.save(path)
            with open(path) as fh:
                content = fh.read()
            assert content == sample_circuit.qasm
        finally:
            Path(path).unlink(missing_ok=True)

    def test_clean_qasm_strips_comments(self):
        circuit = QuantumCircuit(
            qasm='// header\nOPENQASM 2.0;\n// another comment\nqreg q[2];\n',
            qubits=2, depth=1, gate_count=1,
        )
        clean = circuit.clean_qasm
        assert "// header" not in clean
        assert "// another comment" not in clean
        assert "OPENQASM 2.0;" in clean
        assert "qreg q[2];" in clean

    def test_clean_qasm_no_comments(self):
        qasm = 'OPENQASM 2.0;\nqreg q[2];'
        circuit = QuantumCircuit(qasm=qasm + '\n', qubits=2, depth=1, gate_count=1)
        assert circuit.clean_qasm == qasm

    def test_repr_format(self, sample_circuit):
        r = repr(sample_circuit)
        assert "QuantumCircuit" in r
        assert "algorithm='vqe'" in r
        assert "qubits=2" in r
        assert "depth=3" in r
        assert "gates=4" in r
        assert "transpiled" in r

    def test_repr_not_transpiled(self):
        circuit = QuantumCircuit(qasm="", qubits=1, depth=0, gate_count=0, transpiled=False)
        assert "transpiled" not in repr(circuit)
