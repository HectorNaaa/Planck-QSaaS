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
        backend: Backend used for execution
        shots: Number of shots executed
        algorithm: Algorithm type
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
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary representation."""
        return {
            "execution_id": self.execution_id,
            "counts": self.counts,
            "success_rate": self.success_rate,
            "runtime_ms": self.runtime_ms,
            "fidelity": self.fidelity,
            "most_frequent": self.most_frequent,
            "probabilities": self.probabilities,
            "backend": self.backend,
            "shots": self.shots,
            "algorithm": self.algorithm,
            "circuit": self.circuit.to_dict() if self.circuit else None,
        }
    
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
    
    def __repr__(self) -> str:
        return (
            f"ExecutionResult(id='{self.execution_id}', "
            f"shots={self.shots}, fidelity={self.fidelity:.3f}, "
            f"runtime={self.runtime_ms:.1f}ms)"
        )
