// VQE Hardware-Efficient Ansatz
// For molecular energy estimation
OPENQASM 2.0;
include "qelib1.inc";

qreg q[4];
creg c[4];

// Layer 1: Rotation layer
ry(0.5236) q[0];
ry(1.0472) q[1];
ry(0.7854) q[2];
ry(1.5708) q[3];

// Entangling layer
cx q[0],q[1];
cx q[1],q[2];
cx q[2],q[3];

// Additional rotations
rz(0.3927) q[0];
rz(0.7854) q[1];
rz(1.1781) q[2];
rz(0.5236) q[3];

// Layer 2: Rotation layer
ry(1.2566) q[0];
ry(0.6283) q[1];
ry(0.9425) q[2];
ry(1.8850) q[3];

// Entangling layer
cx q[0],q[1];
cx q[1],q[2];
cx q[2],q[3];

// Final rotations
rz(0.5236) q[0];
rz(0.9425) q[1];
rz(0.3142) q[2];
rz(1.0472) q[3];

// Measure in computational basis
measure q -> c;

// Classical optimizer uses results to update parameters
