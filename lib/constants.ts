export const QUANTUM_ALGORITHMS = [
  {
    id: "bell-state",
    name: "Bell State",
    description: "Create a maximally entangled quantum state",
    category: "Foundation",
  },
  {
    id: "grovers",
    name: "Grover's Algorithm",
    description: "Search an unsorted database in O(√N)",
    category: "Search",
  },
  {
    id: "shors",
    name: "Shor's Algorithm",
    description: "Factor large numbers exponentially faster",
    category: "Factoring",
  },
  {
    id: "vqe",
    name: "VQE Optimizer",
    description: "Variational Quantum Eigensolver for molecules",
    category: "Optimization",
  },
]

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
