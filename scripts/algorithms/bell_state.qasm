// Bell State (EPR Pair) Algorithm
// Creates maximal entanglement between two qubits
OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

// Initialize superposition on qubit 0
h q[0];

// Create entanglement with CNOT
cx q[0],q[1];

// Measure both qubits
measure q[0] -> c[0];
measure q[1] -> c[1];

// Expected results: 50% |00⟩, 50% |11⟩
// Demonstrates quantum entanglement
