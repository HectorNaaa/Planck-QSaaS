"""
Planck SDK - Execution Result representation
"""

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .circuit import QuantumCircuit


@dataclass
class ExecutionResult:
    """
    Represents the result of a quantum circuit execution.
    
    Attributes:
        execution_id: Unique identifier for this execution
        counts: Measurement counts for each basis state
        success_rate: Success rate percentage
        runtime_ms: Execution runtime in milliseconds
        memory: List of measurement outcomes
        circuit: The executed QuantumCircuit (if available)
        backend: Effective backend that was actually used (resolved by policy)
        shots: Number of shots executed
        algorithm: Algorithm type
        backend_reason: Human-readable explanation of why this backend was chosen
        backend_hint: The backend the user originally requested (None if 'auto')
    """
    execution_id: Optional[str]
    counts: Dict[str, int]
    success_rate: float
    runtime_ms: float
    memory: List[str] = field(default_factory=list)
    circuit: Optional[QuantumCircuit] = None
    backend: str = "unknown"
    shots: int = 0
    algorithm: str = "unknown"
    backend_reason: Optional[str] = None
    backend_hint: Optional[str] = None
    digital_twin: Optional[Dict[str, Any]] = None
    error_mitigation: str = "medium"
    error_mitigation_requested: Optional[str] = None
    ml_tuning: Optional[Dict[str, Any]] = None
    
    @property
    def fidelity(self) -> float:
        """Estimated fidelity based on success rate."""
        return self.success_rate / 100.0
    
    @property
    def most_frequent(self) -> str:
        """Return the most frequently measured state."""
        if not self.counts:
            return ""
        return max(self.counts, key=self.counts.get)
    
    @property
    def probabilities(self) -> Dict[str, float]:
        """Return measurement probabilities for each state."""
        total = sum(self.counts.values())
        if total == 0:
            return {}
        return {k: v / total for k, v in self.counts.items()}
    
    @property
    def overview(self) -> Optional[Dict[str, Any]]:
        """Digital Twin overview: interpretation + performance metrics + quantum metrics."""
        if not self.digital_twin:
            return None
        return {
            "interpretation": self.digital_twin.get("interpretation", ""),
            "performance_metrics": self.digital_twin.get("performance_metrics", {}),
            "quantum_metrics": self.digital_twin.get("quantum_metrics", {}),
        }
    
    @property
    def analysis(self) -> Optional[Dict[str, Any]]:
        """Digital Twin analysis: behavior insights, data patterns, topology."""
        if not self.digital_twin:
            return None
        return {
            "behavior_insights": self.digital_twin.get("behavior_insights", []),
            "data_patterns": self.digital_twin.get("data_patterns", []),
            "topology_insights": self.digital_twin.get("topology_insights", []),
        }
    
    @property
    def recommendations(self) -> Optional[List[str]]:
        """Digital Twin system recommendations."""
        if not self.digital_twin:
            return None
        return self.digital_twin.get("system_recommendations", [])
    
    @property
    def performance(self) -> Optional[Dict[str, str]]:
        """Digital Twin performance metrics (executionSpeed, convergence, reliability)."""
        if not self.digital_twin:
            return None
        return self.digital_twin.get("performance_metrics", {})

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary representation."""
        d: Dict[str, Any] = {
            "execution_id": self.execution_id,
            "counts": self.counts,
            "success_rate": self.success_rate,
            "runtime_ms": self.runtime_ms,
            "fidelity": self.fidelity,
            "most_frequent": self.most_frequent,
            "probabilities": self.probabilities,
            "backend": self.backend,
            "backend_reason": self.backend_reason,
            "backend_hint": self.backend_hint,
            "shots": self.shots,
            "algorithm": self.algorithm,
            "circuit": self.circuit.to_dict() if self.circuit else None,
            "digital_twin": self.digital_twin,
            "error_mitigation": self.error_mitigation,
            "error_mitigation_requested": self.error_mitigation_requested,
            "ml_tuning": self.ml_tuning,
        }
        return d
    
    def to_json(self, indent: int = 2) -> str:
        """Convert result to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)
    
    def save(self, filepath: str) -> None:
        """
        Save result to a JSON file.
        
        Args:
            filepath: Path to save the file
        """
        with open(filepath, "w") as f:
            f.write(self.to_json())
    
    def plot_histogram(self, top_n: int = 10) -> None:
        """
        Print a simple ASCII histogram of measurement counts.
        
        Args:
            top_n: Number of top states to show
        """
        if not self.counts:
            print("No measurement data available")
            return
        
        sorted_counts = sorted(
            self.counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_n]
        
        max_count = max(c for _, c in sorted_counts)
        max_bar_width = 40
        
        print(f"\nMeasurement Results (top {min(top_n, len(sorted_counts))} states)")
        print("-" * 60)
        
        for state, count in sorted_counts:
            bar_width = int((count / max_count) * max_bar_width)
            bar = "#" * bar_width
            prob = count / self.shots * 100
            print(f"|{state}> : {bar} {count} ({prob:.1f}%)")
        
        print("-" * 60)
        print(f"Total shots: {self.shots}")
        print(f"Unique states: {len(self.counts)}")
        print(f"Fidelity: {self.fidelity:.3f}")
        print(f"Backend: {self.backend}")
        if self.backend_reason:
            print(f"Reason: {self.backend_reason}")
        if self.backend_hint:
            print(f"Hint: {self.backend_hint}")
        if self.error_mitigation_requested == "auto":
            print(f"\nError Mitigation: {self.error_mitigation} (auto-resolved by RL)")
        else:
            print(f"\nError Mitigation: {self.error_mitigation}")
        if self.ml_tuning:
            print(f"ML Tuning: {self.ml_tuning.get('reasoning', 'N/A')}")
            print(f"  Confidence: {self.ml_tuning.get('confidence', 0):.2%}")
            print(f"  Based on: {self.ml_tuning.get('based_on_executions', 0)} prior runs")
        if self.digital_twin:
            pm = self.digital_twin.get("performance_metrics", {})
            print(f"\nDigital Twin:")
            print(f"  Speed: {pm.get('executionSpeed', 'N/A')}")
            print(f"  Convergence: {pm.get('convergence', 'N/A')}")
            print(f"  Reliability: {pm.get('reliability', 'N/A')}")
            recs = self.digital_twin.get("system_recommendations", [])
            if recs:
                print(f"  Recommendations:")
                for r in recs[:3]:
                    print(f"    -> {r}")
    
    def __repr__(self) -> str:
        return (
            f"ExecutionResult(id='{self.execution_id}', "
            f"shots={self.shots}, fidelity={self.fidelity:.3f}, "
            f"runtime={self.runtime_ms:.1f}ms)"
        )
