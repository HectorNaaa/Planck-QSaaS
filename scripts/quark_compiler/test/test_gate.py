"""Unit tests for the Gate class."""

import pytest

from src.gate import Gate, GateType


def test_valid_gate_creation() -> None:
    """Tests that a valid gate sets up properties correctly."""
    gate = Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,))
    # Write assertions to verify gate_type, target_qubits, and control_qubits match
    assert gate.gate_type == GateType.CNOT
    assert gate.target_qubits == (1,)
    assert gate.control_qubits == (0,)
    assert gate.all_qubits == {0, 1}
    # Add assertions for targets, controls, and all_qubits here...


def test_overlapping_qubits_raises_error() -> None:
    """Tests that a non-physical gate triggers a ValueError."""
    with pytest.raises(expected_exception=ValueError):
        Gate(GateType.CNOT, target_qubits=(0,), control_qubits=(0,))
        # Instantiate a gate where a qubit is both target and control


def test_gate_immutability() -> None:
    """Tests that public properties cannot be overwritten."""
    gate = Gate(GateType.X, target_qubits=(0,))
    with pytest.raises(expected_exception=AttributeError):
        gate.gate_type = GateType.H
        # Try to manually change gate.gate_type to GateType.H

    with pytest.raises(expected_exception=AttributeError):
        gate.target_qubits = (1,)
        # Try to manually change gate.target_qubits to (1,)

    with pytest.raises(expected_exception=AttributeError):
        gate.control_qubits = (1,)
        # Try to manually change gate.control_qubits to (1,)

    with pytest.raises(expected_exception=AttributeError):
        gate.all_qubits = {
            1,
        }
        # Try to manually change gate.all_qubits to {1,}


def test_invalid_gate_no_target_qubits() -> None:
    """Tests that creating a gate with no target qubits raises ValueError."""
    with pytest.raises(expected_exception=ValueError):
        Gate(GateType.H, target_qubits=(), control_qubits=None)
        # Instantiate a gate with no target qubits


def test_gate_is_self_inverse() -> None:
    """Tests the is_self_inverse property for self-inverse and non-self-inverse gates."""
    self_inverse_gates = [
        Gate(GateType.X, target_qubits=(0,)),
        Gate(GateType.Z, target_qubits=(0,)),
        Gate(GateType.H, target_qubits=(0,)),
        Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,)),
    ]
    non_self_inverse_gates = [
        Gate(GateType.T, target_qubits=(0,)),
        Gate(GateType.S, target_qubits=(0,)),
    ]
    for gate in self_inverse_gates:
        assert gate.is_self_inverse
    for gate in non_self_inverse_gates:
        assert not gate.is_self_inverse


def test_gate_equality_and_hashing() -> None:
    """Verifies that gate equality (__eq__) and hashing (__hash__) behave correctly."""
    two_identical_gates = [
        Gate(GateType.X, target_qubits=(0,)),
        Gate(GateType.X, target_qubits=(0,)),
    ]
    two_different_gates = [
        Gate(GateType.X, target_qubits=(0,)),
        Gate(GateType.T, target_qubits=(0,)),
    ]
    for gate in two_identical_gates:
        assert gate == two_identical_gates[0]
        assert hash(gate) == hash(two_identical_gates[0])

    assert two_different_gates[1] != two_different_gates[0]
    assert hash(two_different_gates[1]) != hash(two_different_gates[0])

    assert "GateType.T, target_qubits=(0,)" != Gate(GateType.T, target_qubits=(0,))
    assert hash("GateType.T, target_qubits=(0,)") != hash(
        Gate(GateType.T, target_qubits=(0,))
    )


def test_gate_repr() -> None:
    """Verifies that __repr__ outputs the correct readable representation."""
    gate = Gate(GateType.H, target_qubits=(0,))
    assert repr(gate) == "Gate(H, targets=[0])"
    gate = Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,))
    assert repr(gate) == "Gate(CNOT, targets=[1], ctrl=[0])"


@pytest.mark.parametrize(
    argnames="gate_a, gate_b, expected_commute",
    argvalues=[
        # --- CASE 1: Completely disjoint qubits ---
        (
            Gate(GateType.X, target_qubits=(0,)),
            Gate(GateType.Z, target_qubits=(1,)),
            True,
        ),
        # --- CASE 2: Same qubit, non-commuting Pauli operators ---
        (
            Gate(GateType.X, target_qubits=(0,)),
            Gate(GateType.Z, target_qubits=(0,)),
            False,
        ),
        # --- CASE 3: Rule 3 (X gate on CNOT control line) ---
        (
            Gate(GateType.X, target_qubits=(0,)),
            Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,)),
            False,
        ),
        # --- CASE 4: Rule 4 (Z gate on CNOT target line) ---
        (
            Gate(GateType.Z, target_qubits=(1,)),
            Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,)),
            False,
        ),
        # --- CASE 5: X gate on CNOT target line ---
        (
            Gate(GateType.X, target_qubits=(1,)),
            Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,)),
            True,
        ),
        # --- CASE 6: Z gate on CNOT control line ---
        (
            Gate(GateType.Z, target_qubits=(0,)),
            Gate(GateType.CNOT, target_qubits=(1,), control_qubits=(0,)),
            True,
        ),
        # CASE 7: Rule 1 (Identical single-qubit gates on the same qubit commute)
        (
            Gate(GateType.H, target_qubits=(0,)),
            Gate(GateType.H, target_qubits=(0,)),
            True,
        ),
        # CASE 8: Rule 2 (Z-basis gates on the same qubit commute)
        (
            Gate(GateType.S, target_qubits=(0,)),
            Gate(GateType.T, target_qubits=(0,)),
            True,
        ),
    ],
)
def test_gate_commutation_rules(
    gate_a: Gate, gate_b: Gate, expected_commute: bool
) -> None:
    """Verifies that commutation rules resolve correctly across different gate layouts.

    Args:
        gate_a: The first gate to compare.
        gate_b: The second gate to compare.
        expected_commute: True if they are expected to commute, False otherwise.
    """
    assert gate_a.commutes_with(other=gate_b) == expected_commute
    # Commutation is symmetric (A commutes with B implies B commutes with A)
    assert gate_b.commutes_with(other=gate_a) == expected_commute
