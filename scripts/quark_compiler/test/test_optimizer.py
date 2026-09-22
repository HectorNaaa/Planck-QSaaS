from src.circuit import Circuit
from src.gate import Gate, GateType
from src.optimizer import GateCancellationPass


def test_baseline_optimizer_returns_copy() -> None:
    """Test that the baseline optimizer returns a new Circuit instance with identical gates."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.H, (0,)))
    circ.add_gate(Gate(GateType.X, (1,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit is not circ
    assert optimized_circuit.num_qubits == circ.num_qubits
    assert optimized_circuit.gates == circ.gates


def test_single_qubit_cancellation() -> None:
    """Test that two adjacent identical self-inverse gates cancel."""
    circ = Circuit(1)
    circ.add_gate(Gate(GateType.X, (0,)))
    circ.add_gate(Gate(GateType.X, (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == ()


def test_single_qubit_commutation_cancellation() -> None:
    """Test that two identical self-inverse gates cancel after commuting past an intervening gate."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.X, (0,)))
    circ.add_gate(Gate(GateType.Z, (1,)))
    circ.add_gate(Gate(GateType.X, (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == (Gate(GateType.Z, (1,)),)


def test_multi_qubit_cancellation() -> None:
    """Test CNOT adjacent cancellation."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == ()


def test_multi_qubit_commutation_cancellation() -> None:
    """Test CNOT lookahead cancellation with commuting gates on target and control lines."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    circ.add_gate(Gate(GateType.X, (1,)))
    circ.add_gate(Gate(GateType.Z, (0,)))
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == (
        Gate(GateType.X, (1,)),
        Gate(GateType.Z, (0,)),
    )


def test_non_cancellation_due_to_non_commutation() -> None:
    """Test that non-commuting intervening gates block cancellation."""
    circ = Circuit(1)
    circ.add_gate(Gate(GateType.X, (0,)))
    circ.add_gate(Gate(GateType.Z, (0,)))
    circ.add_gate(Gate(GateType.X, (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == (
        Gate(GateType.X, (0,)),
        Gate(GateType.Z, (0,)),
        Gate(GateType.X, (0,)),
    )


def test_nested_cancellation() -> None:
    """Test that cancellations can be nested and repeated across multiple passes."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.H, (0,)))
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    circ.add_gate(Gate(GateType.H, (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == ()


def test_cnot_lookahead_fails_on_second_wire() -> None:
    """Test that lookahead fails if one of the CNOT lines is blocked by a non-commuting gate."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    circ.add_gate(Gate(GateType.Z, (1,)))
    circ.add_gate(Gate(GateType.CNOT, (1,), (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == (
        Gate(GateType.CNOT, (1,), (0,)),
        Gate(GateType.Z, (1,)),
        Gate(GateType.CNOT, (1,), (0,)),
    )


def test_rewiring_intervening_gates_with_outer_neighbors() -> None:
    """Test that graph rewiring correctly bridges intervening gates when outer neighbors exist."""
    circ = Circuit(2)
    circ.add_gate(Gate(GateType.H, (0,)))
    circ.add_gate(Gate(GateType.X, (0,)))
    circ.add_gate(Gate(GateType.CNOT, (0,), (1,)))
    circ.add_gate(Gate(GateType.X, (0,)))
    circ.add_gate(Gate(GateType.H, (0,)))
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circ)
    assert optimized_circuit.gates == (
        Gate(GateType.H, (0,)),
        Gate(GateType.CNOT, (0,), (1,)),
        Gate(GateType.H, (0,)),
    )
