export const QUANTUM_TEMPLATES = [
  {
    id: "bell-state",
    name: "Bell",
    description: "Create an entangled quantum state for system interconectivity and secure communication.",
    shortDescription: "Create an entangled quantum state for system interconectivity and secure communication",
    minQubits: 2,
    difficulty: "Beginner",
    icon: "/images/bell-20icon-20planck.png",
    format: "QASM",
  },
  {
    id: "grovers",
    name: "Grover",
    description: "Search unsorted databases for pattern matching and unstructured search problems.",
    shortDescription: "Search unsorted databases for pattern matching and unstructured search problems",
    minQubits: 8,
    difficulty: "Intermediate",
    icon: "/images/grover-20icon-20planck.png",
    format: "QASM",
  },
  {
    id: "shors",
    name: "Shor",
    description: "Factor large numbers for cryptanalysis and number theory research applications.",
    shortDescription: "Factor large numbers for cryptanalysis and number theory research applications",
    minQubits: 16,
    difficulty: "Advanced",
    icon: "/images/shor-20planck.png",
    format: "Qiskit",
  },
  {
    id: "vqe",
    name: "VQE",
    description: "Variational Quantum Eigensolver for finding ground state energies and optimization.",
    shortDescription: "Variational Quantum Eigensolver for finding ground state energies and optimization",
    minQubits: 12,
    difficulty: "Advanced",
    icon: "/images/vqe-20icon-20planck.png",
    format: "Qiskit",
  },
  {
    id: "qaoa",
    name: "QAOA",
    description: "Quantum Approximate Optimization for combinatorial optimization and constraint satisfaction.",
    shortDescription: "Quantum Approximate Optimization for combinatorial optimization and constraint satisfaction",
    minQubits: 10,
    difficulty: "Intermediate",
    icon: "/images/qaoa-20icon-20planck.png",
    format: "QASM",
  },
]

export const QUANTUM_ALGORITHMS = QUANTUM_TEMPLATES.map((t) => ({
  id: t.id,
  name: t.name,
  description: t.shortDescription,
  category: t.difficulty,
}))

export const DEFAULT_SETTINGS = {
  theme: "light",
  notifications: true,
  autoSave: true,
}

export const PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    qubits: 8,
    runs: 1000,
  },
  {
    id: "professional",
    name: "Professional",
    price: 99,
    qubits: 20,
    runs: 50000,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    qubits: 100,
    runs: null,
  },
]
