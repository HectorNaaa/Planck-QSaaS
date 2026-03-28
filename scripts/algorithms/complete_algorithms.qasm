// ============================================
// Complete Algorithm Implementations
// Ready-to-run quantum circuits
// ============================================

OPENQASM 2.0;
include "qelib1.inc";

// ============================================
// BELL STATE CIRCUIT
// ============================================
qreg bell_q[2];
creg bell_c[2];

// Create Bell state
h bell_q[0];
cx bell_q[0], bell_q[1];

// Measure
measure bell_q[0] -> bell_c[0];
measure bell_q[1] -> bell_c[1];

// ============================================
// GROVER 4-QUBIT SEARCH
// ============================================
qreg grover_q[4];
creg grover_c[4];

// Initialize superposition
h grover_q[0];
h grover_q[1];
h grover_q[2];
h grover_q[3];

// Grover iteration 1
// Oracle (mark |1111⟩)
h grover_q[3];
ccx grover_q[0], grover_q[1], grover_q[2];
cx grover_q[2], grover_q[3];
ccx grover_q[0], grover_q[1], grover_q[2];
h grover_q[3];

// Diffusion
h grover_q[0]; h grover_q[1]; h grover_q[2]; h grover_q[3];
x grover_q[0]; x grover_q[1]; x grover_q[2]; x grover_q[3];
h grover_q[3];
ccx grover_q[0], grover_q[1], grover_q[2];
cx grover_q[2], grover_q[3];
ccx grover_q[0], grover_q[1], grover_q[2];
h grover_q[3];
x grover_q[0]; x grover_q[1]; x grover_q[2]; x grover_q[3];
h grover_q[0]; h grover_q[1]; h grover_q[2]; h grover_q[3];

// Measure
measure grover_q -> grover_c;

// ============================================
// VQE CIRCUIT (H2 molecule)
// ============================================
qreg vqe_q[4];
creg vqe_c[4];

// Initial state preparation
x vqe_q[0];
x vqe_q[1];

// Ansatz layer 1
ry(0.785) vqe_q[0];
ry(1.571) vqe_q[1];
ry(0.785) vqe_q[2];
ry(1.571) vqe_q[3];
cx vqe_q[0], vqe_q[1];
cx vqe_q[1], vqe_q[2];
cx vqe_q[2], vqe_q[3];

// Ansatz layer 2
ry(0.392) vqe_q[0];
ry(0.785) vqe_q[1];
ry(0.392) vqe_q[2];
ry(0.785) vqe_q[3];
cx vqe_q[0], vqe_q[1];
cx vqe_q[1], vqe_q[2];
cx vqe_q[2], vqe_q[3];

// Measure in Z basis
measure vqe_q -> vqe_c;

// ============================================
// QAOA MAXCUT (4-node graph)
// ============================================
qreg qaoa_q[4];
creg qaoa_c[4];

// Initialize equal superposition
h qaoa_q[0];
h qaoa_q[1];
h qaoa_q[2];
h qaoa_q[3];

// QAOA layer 1 (γ₁ = 0.5)
cx qaoa_q[0], qaoa_q[1];
rz(1.0) qaoa_q[1];
cx qaoa_q[0], qaoa_q[1];

cx qaoa_q[1], qaoa_q[2];
rz(1.0) qaoa_q[2];
cx qaoa_q[1], qaoa_q[2];

cx qaoa_q[2], qaoa_q[3];
rz(1.0) qaoa_q[3];
cx qaoa_q[2], qaoa_q[3];

// Mixer (β₁ = 0.25)
rx(0.5) qaoa_q[0];
rx(0.5) qaoa_q[1];
rx(0.5) qaoa_q[2];
rx(0.5) qaoa_q[3];

// QAOA layer 2 (γ₂ = 0.7)
cx qaoa_q[0], qaoa_q[1];
rz(1.4) qaoa_q[1];
cx qaoa_q[0], qaoa_q[1];

cx qaoa_q[1], qaoa_q[2];
rz(1.4) qaoa_q[2];
cx qaoa_q[1], qaoa_q[2];

cx qaoa_q[2], qaoa_q[3];
rz(1.4) qaoa_q[3];
cx qaoa_q[2], qaoa_q[3];

// Mixer (β₂ = 0.35)
rx(0.7) qaoa_q[0];
rx(0.7) qaoa_q[1];
rx(0.7) qaoa_q[2];
rx(0.7) qaoa_q[3];

// Measure
measure qaoa_q -> qaoa_c;

// ============================================
// SHOR'S ALGORITHM (simplified QFT example)
// ============================================
qreg shor_q[8];
creg shor_c[4];

// Initialize first 4 qubits to superposition
h shor_q[0];
h shor_q[1];
h shor_q[2];
h shor_q[3];

// Controlled modular exponentiation (simplified)
cx shor_q[0], shor_q[4];
cx shor_q[1], shor_q[5];
cx shor_q[2], shor_q[6];
cx shor_q[3], shor_q[7];

// Inverse QFT on first 4 qubits
swap shor_q[1], shor_q[2];
swap shor_q[0], shor_q[3];
h shor_q[3];
cp(-1.571) shor_q[3], shor_q[2];
h shor_q[2];
cp(-0.785) shor_q[3], shor_q[1];
cp(-1.571) shor_q[2], shor_q[1];
h shor_q[1];
cp(-0.393) shor_q[3], shor_q[0];
cp(-0.785) shor_q[2], shor_q[0];
cp(-1.571) shor_q[1], shor_q[0];
h shor_q[0];

// Measure control register
measure shor_q[0] -> shor_c[0];
measure shor_q[1] -> shor_c[1];
measure shor_q[2] -> shor_c[2];
measure shor_q[3] -> shor_c[3];
