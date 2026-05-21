import json
import tempfile
from pathlib import Path

import pytest

from planck_sdk.circuit import QuantumCircuit
from planck_sdk.result import ExecutionResult


def make_result(**overrides) -> ExecutionResult:
    defaults = dict(
        execution_id="exec-001",
        counts={"00": 600, "11": 400},
        success_rate=95.0,
        runtime_ms=123.4,
        memory=[],
        circuit=None,
        backend="quantum_inspired_gpu",
        shots=1000,
        algorithm="vqe",
        backend_reason="Latency-first selection",
        backend_hint=None,
        digital_twin=None,
        error_mitigation="medium",
        error_mitigation_requested=None,
        ml_tuning=None,
    )
    defaults.update(overrides)
    return ExecutionResult(**defaults)


class TestExecutionResultProperties:
    def test_fidelity(self):
        r = make_result(success_rate=85.0)
        assert r.fidelity == 0.85

    def test_fidelity_zero(self):
        r = make_result(success_rate=0.0)
        assert r.fidelity == 0.0

    def test_most_frequent(self):
        r = make_result(counts={"00": 600, "11": 400})
        assert r.most_frequent == "00"

    def test_most_frequent_empty_counts(self):
        r = make_result(counts={})
        assert r.most_frequent == ""

    def test_probabilities(self):
        r = make_result(counts={"00": 750, "11": 250})
        probs = r.probabilities
        assert probs["00"] == 0.75
        assert probs["11"] == 0.25

    def test_probabilities_empty_counts(self):
        r = make_result(counts={})
        assert r.probabilities == {}

    def test_probabilities_sum_to_one(self):
        r = make_result(counts={"00": 512, "01": 256, "10": 128, "11": 128})
        total = sum(r.probabilities.values())
        assert abs(total - 1.0) < 1e-9


class TestDigitalTwinProperties:
    def test_overview_none_when_no_digital_twin(self):
        r = make_result(digital_twin=None)
        assert r.overview is None

    def test_overview_with_digital_twin(self):
        dt = {
            "interpretation": "Good results",
            "performance_metrics": {"speed": "fast"},
            "quantum_metrics": {"fidelity": 0.95},
        }
        r = make_result(digital_twin=dt)
        ov = r.overview
        assert ov["interpretation"] == "Good results"
        assert ov["performance_metrics"]["speed"] == "fast"

    def test_analysis_none_when_no_digital_twin(self):
        r = make_result(digital_twin=None)
        assert r.analysis is None

    def test_analysis_with_digital_twin(self):
        dt = {
            "behavior_insights": ["insight1"],
            "data_patterns": ["pattern1"],
            "topology_insights": ["topo1"],
        }
        r = make_result(digital_twin=dt)
        a = r.analysis
        assert a["behavior_insights"] == ["insight1"]
        assert a["topology_insights"] == ["topo1"]

    def test_recommendations_none_when_no_digital_twin(self):
        r = make_result(digital_twin=None)
        assert r.recommendations is None

    def test_recommendations_with_digital_twin(self):
        dt = {"system_recommendations": ["use hpc_gpu", "increase shots"]}
        r = make_result(digital_twin=dt)
        assert r.recommendations == ["use hpc_gpu", "increase shots"]

    def test_performance_none_when_no_digital_twin(self):
        r = make_result(digital_twin=None)
        assert r.performance is None

    def test_performance_with_digital_twin(self):
        dt = {"performance_metrics": {"executionSpeed": "fast", "convergence": "good"}}
        r = make_result(digital_twin=dt)
        assert r.performance["executionSpeed"] == "fast"


class TestExecutionResultSerialization:
    def test_to_dict(self):
        r = make_result()
        d = r.to_dict()
        assert d["execution_id"] == "exec-001"
        assert d["fidelity"] == 0.95
        assert d["backend"] == "quantum_inspired_gpu"
        assert d["circuit"] is None

    def test_to_dict_with_circuit(self, sample_circuit):
        r = make_result(circuit=sample_circuit)
        d = r.to_dict()
        assert d["circuit"] is not None
        assert d["circuit"]["algorithm"] == "vqe"

    def test_to_json(self):
        r = make_result()
        s = r.to_json()
        parsed = json.loads(s)
        assert parsed["execution_id"] == "exec-001"

    def test_save(self):
        r = make_result()
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            path = f.name
        try:
            r.save(path)
            with open(path) as fh:
                parsed = json.load(fh)
            assert parsed["execution_id"] == "exec-001"
        finally:
            Path(path).unlink(missing_ok=True)


class TestPlotHistogram:
    def test_plot_histogram_empty_counts(self, capsys):
        r = make_result(counts={})
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "No measurement data" in captured.out

    def test_plot_histogram_output(self, capsys):
        r = make_result(counts={"00": 800, "11": 200})
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "|00>" in captured.out
        assert "|11>" in captured.out
        assert "Fidelity:" in captured.out
        assert "quantum_inspired_gpu" in captured.out

    def test_repr_format(self):
        r = make_result()
        rep = repr(r)
        assert "ExecutionResult" in rep
        assert "exec-001" in rep
        assert "0.950" in rep

    def test_plot_histogram_error_mitigation_auto(self, capsys):
        r = make_result(error_mitigation_requested="auto", error_mitigation="low")
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "auto-resolved by RL" in captured.out

    def test_plot_histogram_error_mitigation_manual(self, capsys):
        r = make_result(error_mitigation_requested="high", error_mitigation="high")
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "Error Mitigation: high" in captured.out

    def test_plot_histogram_with_ml_tuning(self, capsys):
        r = make_result(
            ml_tuning={"confidence": 0.85, "reasoning": "test reasoning", "based_on_executions": 10}
        )
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "ML Tuning" in captured.out
        assert "test reasoning" in captured.out
        assert "85.00%" in captured.out
        assert "10 prior runs" in captured.out

    def test_plot_histogram_with_digital_twin(self, capsys):
        r = make_result(digital_twin={
            "performance_metrics": {
                "executionSpeed": "fast",
                "convergence": "good",
                "reliability": "high",
            },
            "system_recommendations": ["use hpc_gpu", "increase shots", "try error mitigation"],
        })
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "Digital Twin" in captured.out
        assert "Speed: fast" in captured.out
        assert "Convergence: good" in captured.out
        assert "Reliability: high" in captured.out
        assert "Recommendations" in captured.out
        assert "use hpc_gpu" in captured.out

    def test_plot_histogram_with_backend_hint(self, capsys):
        r = make_result(backend_hint="quantum_qpu")
        r.plot_histogram()
        captured = capsys.readouterr()
        assert "Hint: quantum_qpu" in captured.out
