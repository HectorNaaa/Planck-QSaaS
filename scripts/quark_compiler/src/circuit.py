"""Quantum circuit representation and management."""

import networkx as nx

from src.gate import Gate


class Circuit:
    """A quantum circuit consisting of multiple gates.

    Attributes:
        num_qubits: The number of qubits in the circuit.
        gates: A tuple of gates in the circuit.
    """

    __slots__ = ("_num_qubits", "_gates")

    def __init__(self, num_qubits: int) -> None:
        """Initializes the Circuit with a specified number of qubits.

        Args:
            num_qubits: The number of qubits in the circuit.
        """
        self._num_qubits = num_qubits
        self._gates = []

    @property
    def num_qubits(self) -> int:
        """Gets the number of qubits in the circuit (read-only).

        Returns:
            The number of qubits.
        """
        return self._num_qubits

    @property
    def gates(self) -> tuple[Gate, ...]:
        """Gets all the gates added to the circuit.

        Returns:
            A tuple of Gate objects in the order they were added.
        """
        return tuple(self._gates)

    def add_gate(self, gate: Gate) -> None:
        """Adds a gate to the circuit after validating qubit boundaries.

        Args:
            gate: The quantum gate to add.

        Raises:
            IndexError: If any qubit index involved in the gate is out of bounds
                for this circuit.
        """
        for qubit in gate.all_qubits:
            if qubit >= self._num_qubits:
                raise IndexError("Qubit index out of bounds")
        self._gates.append(gate)

    def to_dag(self) -> nx.DiGraph:
        """Converts the circuit into a Directed Acyclic Graph (DAG) representing gate dependencies.

        Returns:
            A networkx.DiGraph where nodes are unique (idx, gate) tuples.
        """
        dag = nx.DiGraph()
        last_gate_on_wire = dict.fromkeys(range(self.num_qubits), None)
        for idx, gate in enumerate(self._gates):
            node_id = (idx, gate)
            dag.add_node(node_id)
            for qubit in gate.all_qubits:
                if last_gate_on_wire[qubit] is not None:
                    dag.add_edge(last_gate_on_wire[qubit], node_id)
                last_gate_on_wire[qubit] = node_id
        return dag
