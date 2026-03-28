// QAOA for Max-Cut Problem
// Quantum approximate optimization
OPENQASM 2.0;
include "qelib1.inc";

qreg q[4];
creg c[4];

// Initialize superposition
h q[0];
h q[1];
h q[2];
h q[3];

// Problem Hamiltonian (gamma = π/4)
// Edge (0,1)
cx q[0],q[1];
rz(1.5708) q[1];
cx q[0],q[1];

// Edge (1,2)
cx q[1],q[2];
rz(1.5708) q[2];
cx q[1],q[2];

// Edge (2,3)
cx q[2],q[3];
rz(1.5708) q[3];
cx q[2],q[3];

// Mixer Hamiltonian (beta = π/8)
rx(0.7854) q[0];
rx(0.7854) q[1];
rx(0.7854) q[2];
rx(0.7854) q[3];

// Measure
measure q -> c;

// Outputs approximate solution to Max-Cut
