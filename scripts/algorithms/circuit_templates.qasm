// ============================================
// Quantum Circuit Templates Library
// OpenQASM 2.0 - Reusable circuit patterns
// ============================================

OPENQASM 2.0;
include "qelib1.inc";

// ============================================
// ENTANGLEMENT TEMPLATES
// ============================================

// Bell State (EPR Pair)
gate bell_pair q0, q1 {
  h q0;
  cx q0, q1;
}

// GHZ State (N-qubit entanglement)
gate ghz_state q0, q1, q2 {
  h q0;
  cx q0, q1;
  cx q0, q2;
}

// W State
gate w_state q0, q1, q2 {
  ry(1.9106) q0;
  ch q0, q1;
  x q0;
  ch q0, q2;
  x q0;
}

// ============================================
// GROVER SEARCH COMPONENTS
// ============================================

// Diffusion operator for Grover's algorithm
gate diffusion q0, q1, q2, q3 {
  h q0; h q1; h q2; h q3;
  x q0; x q1; x q2; x q3;
  h q3;
  ccx q0, q1, q2;
  cx q2, q3;
  ccx q0, q1, q2;
  h q3;
  x q0; x q1; x q2; x q3;
  h q0; h q1; h q2; h q3;
}

// Oracle marker (controlled-Z)
gate oracle_marker q0, q1, q2, q3 {
  h q3;
  ccx q0, q1, q2;
  cx q2, q3;
  ccx q0, q1, q2;
  h q3;
}

// ============================================
// QUANTUM FOURIER TRANSFORM
// ============================================

// QFT for 4 qubits
gate qft_4 q0, q1, q2, q3 {
  // Qubit 0
  h q0;
  cp(pi/2) q1, q0;
  cp(pi/4) q2, q0;
  cp(pi/8) q3, q0;
  
  // Qubit 1
  h q1;
  cp(pi/2) q2, q1;
  cp(pi/4) q3, q1;
  
  // Qubit 2
  h q2;
  cp(pi/2) q3, q2;
  
  // Qubit 3
  h q3;
  
  // Swap for correct order
  swap q0, q3;
  swap q1, q2;
}

// Inverse QFT for 4 qubits
gate iqft_4 q0, q1, q2, q3 {
  swap q1, q2;
  swap q0, q3;
  h q3;
  cp(-pi/2) q3, q2;
  h q2;
  cp(-pi/4) q3, q1;
  cp(-pi/2) q2, q1;
  h q1;
  cp(-pi/8) q3, q0;
  cp(-pi/4) q2, q0;
  cp(-pi/2) q1, q0;
  h q0;
}

// ============================================
// VQE ANSATZ TEMPLATES
// ============================================

// Hardware-efficient ansatz layer
gate vqe_layer(theta1, theta2, theta3, theta4) q0, q1, q2, q3 {
  ry(theta1) q0;
  ry(theta2) q1;
  ry(theta3) q2;
  ry(theta4) q3;
  cx q0, q1;
  cx q1, q2;
  cx q2, q3;
}

// UCCSD-inspired ansatz
gate uccsd_ansatz(theta) q0, q1, q2, q3 {
  x q0;
  x q1;
  cx q2, q3;
  rz(theta) q3;
  cx q2, q3;
  cx q0, q1;
  cx q1, q2;
}

// ============================================
// QAOA MIXER AND COST HAMILTONIANS
// ============================================

// QAOA mixer (X rotation on all qubits)
gate qaoa_mixer(beta) q0, q1, q2, q3 {
  rx(2*beta) q0;
  rx(2*beta) q1;
  rx(2*beta) q2;
  rx(2*beta) q3;
}

// QAOA cost Hamiltonian (ZZ interactions for MaxCut)
gate qaoa_cost(gamma) q0, q1, q2, q3 {
  // Edge (0,1)
  cx q0, q1;
  rz(2*gamma) q1;
  cx q0, q1;
  
  // Edge (1,2)
  cx q1, q2;
  rz(2*gamma) q2;
  cx q1, q2;
  
  // Edge (2,3)
  cx q2, q3;
  rz(2*gamma) q3;
  cx q2, q3;
  
  // Edge (3,0)
  cx q3, q0;
  rz(2*gamma) q0;
  cx q3, q0;
}

// ============================================
// ERROR MITIGATION PATTERNS
// ============================================

// Dynamical decoupling (XY-4 sequence)
gate xy4_dd q {
  x q;
  barrier q;
  y q;
  barrier q;
  x q;
  barrier q;
  y q;
}

// Measurement error mitigation calibration
gate mem_calibration q {
  // Prepare |0⟩
  reset q;
  measure q -> c[0];
  
  // Prepare |1⟩
  reset q;
  x q;
  measure q -> c[1];
}

// ============================================
// TRANSPILATION PRIMITIVES
// ============================================

// SWAP gate decomposition
gate swap_decomposed q0, q1 {
  cx q0, q1;
  cx q1, q0;
  cx q0, q1;
}

// Toffoli decomposition
gate toffoli_decomposed q0, q1, q2 {
  h q2;
  cx q1, q2;
  tdg q2;
  cx q0, q2;
  t q2;
  cx q1, q2;
  tdg q2;
  cx q0, q2;
  t q1; t q2; h q2;
  cx q0, q1;
  t q0; tdg q1;
  cx q0, q1;
}
