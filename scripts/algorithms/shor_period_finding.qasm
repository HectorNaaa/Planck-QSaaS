// Shor's Algorithm (Period Finding)
// Simplified version for factoring
OPENQASM 2.0;
include "qelib1.inc";

qreg control[8];
qreg target[8];
creg c[8];

// Initialize control register to superposition
h control[0];
h control[1];
h control[2];
h control[3];
h control[4];
h control[5];
h control[6];
h control[7];

// Controlled modular exponentiation
// Simplified controlled-U operations
cx control[0],target[0];
cx control[1],target[1];
cx control[2],target[2];
cx control[3],target[3];

// Inverse QFT on control register
// Swap qubits
swap control[0],control[7];
swap control[1],control[6];
swap control[2],control[5];
swap control[3],control[4];

// QFT inverse rotations
h control[0];
cp(-1.5708) control[1],control[0];
cp(-0.7854) control[2],control[0];
cp(-0.3927) control[3],control[0];

h control[1];
cp(-1.5708) control[2],control[1];
cp(-0.7854) control[3],control[1];

h control[2];
cp(-1.5708) control[3],control[2];

h control[3];

// Measure control register
measure control -> c;

// Classical post-processing finds period
