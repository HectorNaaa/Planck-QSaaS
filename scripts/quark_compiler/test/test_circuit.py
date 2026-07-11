"""Unit tests for the Circuit class."""

import networkx as nx
import pytest

from src.circuit import Circuit
from src.gate import Gate, GateType


def test_circuit_creation() -> None:
    """Tests that a Circuit can be initialized with the correct number of qubits."""
    circuit = Circuit(3)
    assert circuit.num_qubits == 3
    assert circuit.gates == ()


def test_add_gate_in_bounds() -> None:
    """Tests adding valid gates to the circuit within qubit bounds."""
    circuit = Circuit(3)
    gate = Gate(GateType.CNOT, (1,), (0,))
    circuit.add_gate(gate)
    assert circuit.gates == (gate,)


def test_add_gate_out_of_bounds() -> None:
    """Tests that adding a gate with out-of-bounds qubits raises IndexError."""
    circuit = Circuit(2)
    gate = Gate(GateType.H, (2,))
    with pytest.raises(IndexError):
        circuit.add_gate(gate)


def test_to_dag_topological_sort() -> None:
    """Test that to_dag creates a DAG that topologically sorts in causal order."""
    circ = Circuit(3)
    h_gate = Gate(GateType.H, (0,))
    cnot_gate = Gate(GateType.CNOT, (1,), (0,))
    x_gate = Gate(GateType.X, (1,))
    circ.add_gate(h_gate)
    circ.add_gate(cnot_gate)
    circ.add_gate(x_gate)
    dag = circ.to_dag()
    sorted_nodes = list(nx.topological_sort(dag))
    assert len(sorted_nodes) == 3
    assert (0, h_gate) in sorted_nodes
    assert (1, cnot_gate) in sorted_nodes
    assert (2, x_gate) in sorted_nodes
    assert sorted_nodes.index((0, h_gate)) < sorted_nodes.index((1, cnot_gate))
    assert sorted_nodes.index((1, cnot_gate)) < sorted_nodes.index((2, x_gate))
