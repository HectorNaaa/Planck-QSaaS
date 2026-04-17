"""
planck_sdk/circuit.py
─────────────────────────────────────────────────────────────────────────────
Quantum circuit data structures for the Planck SDK.

The SDK does NOT build QASM locally. Circuit construction happens server-side
in lib/circuit-builder.ts (TypeScript, parametric) with an optional C++ gate-
optimiser pass (scripts/transpile_circuit.cpp). The Python SDK sends raw input
data to the API and receives a ready-to-run QuantumCircuit in return.

Public classes:
  CircuitBuildOptions  — optional hints the caller may pass to run()
  QuantumCircuit       — server response; immutable after creation
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional


# ─── Build hints ──────────────────────────────────────────────────────────────

@dataclass
class CircuitBuildOptions:
    """
    Optional parametric hints forwarded to the server-side circuit builder.

    All fields are optional — the builder derives sensible defaults from the
    uploaded dataset when a field is None.

    Attributes:
        max_qubits:  Hard cap on qubit count (2–20). Builder will not exceed this
                     even if the data profile would suggest more.
        max_depth:   Hint to limit ansatz/QAOA layers so depth stays manageable.
        angle_scale: Multiply all data-derived rotation angles by this factor.
                     Use < 1.0 to damp rotations, > 1.0 to amplify them.
        force_layers: Override the auto-computed layer count for VQE / QAOA.
    """
    max_qubits:   Optional[int]   = None   # e.g. 8 → keep circuit small
    max_depth:    Optional[int]   = None
    angle_scale:  float           = 1.0    # multiplicative; 1.0 = no change
    force_layers: Optional[int]   = None   # override VQE/QAOA layer count

    def to_dict(self) -> dict:
        return {k: v for k, v in {
            "maxQubits":   self.max_qubits,
            "maxDepth":    self.max_depth,
            "angleScale":  self.angle_scale if self.angle_scale != 1.0 else None,
            "forceLayers": self.force_layers,
        }.items() if v is not None}


# ─── Circuit result ────────────────────────────────────────────────────────────

@dataclass
class QuantumCircuit:
    """
    Immutable representation of a server-generated quantum circuit.

    Attributes:
        qasm:             OpenQASM 2.0 source (parametric, data-driven).
        qubits:           Register size derived from the input data profile.
        depth:            Estimated gate depth after optional C++ transpilation.
        gate_count:       Total gate operations.
        gates:            Parsed gate list (type + qubit indices).
        algorithm:        Algorithm key: vqe | qaoa | grover | shor | bell.
        recommended_shots: ML-tuned shot count for statistical accuracy.
        param_summary:    Human-readable description of how data shaped the circuit.
        transpiled:       True if the C++ gate-optimiser pass was applied.
    """
    qasm:              str
    qubits:            int
    depth:             int
    gate_count:        int
    gates:             List[str]   = field(default_factory=list)
    algorithm:         str         = "vqe"
    recommended_shots: int         = 1024
    param_summary:     str         = ""
    transpiled:        bool        = False
    data_scale:        str         = "small"   # small | medium | large | massive
    layers:            int         = 1         # ansatz / iteration layers used

    # ── Serialisation ──────────────────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Serialise to plain dict (useful for JSON export / logging)."""
        return {
            "qasm":              self.qasm,
            "qubits":            self.qubits,
            "depth":             self.depth,
            "gate_count":        self.gate_count,
            "gates":             self.gates,
            "algorithm":         self.algorithm,
            "recommended_shots": self.recommended_shots,
            "param_summary":     self.param_summary,
            "transpiled":        self.transpiled,
            "data_scale":        self.data_scale,
            "layers":            self.layers,
        }

    @classmethod
    def from_api_response(cls, resp: dict) -> "QuantumCircuit":
        """
        Construct a QuantumCircuit from a raw /api/quantum/simulate response dict.
        Accepts both snake_case and camelCase keys produced by different routes.
        """
        return cls(
            qasm              = resp.get("qasm", ""),
            qubits            = int(resp.get("qubits", 2)),
            depth             = int(resp.get("depth", 0)),
            gate_count        = int(resp.get("gate_count", resp.get("gateCount", 0))),
            gates             = resp.get("gates", []),
            algorithm         = resp.get("algorithm", "vqe"),
            recommended_shots = int(resp.get("recommended_shots", resp.get("recommendedShots", 1024))),
            param_summary     = resp.get("param_summary", resp.get("paramSummary", "")),
            transpiled        = bool(resp.get("transpiled", False)),
            data_scale        = resp.get("data_scale", resp.get("dataScale", "small")),
            layers            = int(resp.get("layers", 1)),
        )

    # ── Convenience ────────────────────────────────────────────────────────────

    def save(self, filepath: str) -> None:
        """Write QASM source to *filepath*."""
        with open(filepath, "w") as fh:
            fh.write(self.qasm)

    @property
    def clean_qasm(self) -> str:
        """QASM with comment lines stripped (useful for display)."""
        return "\n".join(l for l in self.qasm.splitlines() if not l.startswith("//"))

    def __repr__(self) -> str:
        suffix = " (transpiled)" if self.transpiled else ""
        return (
            f"QuantumCircuit(algorithm='{self.algorithm}', qubits={self.qubits}, "
            f"depth={self.depth}, gates={self.gate_count}{suffix})"
        )
