// Grover's Search Algorithm
// Searches unsorted database with O(√N) speedup
OPENQASM 2.0;
include "qelib1.inc";

qreg q[4];
creg c[4];

// Initialize superposition
h q[0];
h q[1];
h q[2];
h q[3];

// Oracle: Mark target state |1011⟩
x q[0];
h q[3];
ccx q[0],q[1],q[2];
ccx q[2],q[2],q[3];
h q[3];
x q[0];

// Diffusion operator
h q[0];
h q[1];
h q[2];
h q[3];

x q[0];
x q[1];
x q[2];
x q[3];

h q[3];
ccx q[0],q[1],q[2];
ccx q[2],q[2],q[3];
h q[3];

x q[0];
x q[1];
x q[2];
x q[3];

h q[0];
h q[1];
h q[2];
h q[3];

// Measurement
measure q -> c;

// Expected: High probability for target state
