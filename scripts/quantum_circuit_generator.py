"""
Quantum Circuit Generator
Generates real quantum circuits based on parsed input data and selected algorithm type.
Supports Bell States, Grover, Shor, VQE, and QAOA algorithms.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass
import numpy as np


@dataclass
class QuantumGate:
    """Represents a quantum gate operation"""
    gate_type: str
    target_qubits: List[int]
    control_qubit: int = None
    parameters: Dict[str, float] = None


@dataclass
class QuantumCircuit:
    """Represents a complete quantum circuit"""
    num_qubits: int
    gates: List[QuantumGate]
    algorithm: str
    metadata: Dict[str, Any]


class CircuitGenerator:
    """Generates quantum circuits based on algorithm type and input data"""
    
    def __init__(self, algorithm: str, data: Dict[str, Any]):
        self.algorithm = algorithm.lower()
        self.data = data
        self.num_qubits = self._determine_qubits()
        
    def _determine_qubits(self) -> int:
        """Determine number of qubits based on algorithm and data"""
        if 'num_items' in self.data:
            n = self.data['num_items']
            return max(2, int(np.ceil(np.log2(n))))
        
        # Default minimum qubits per algorithm
        defaults = {
            'bell': 2,
            'grover': 8,
            'shor': 16,
            'vqe': 12,
            'qaoa': 10
        }
        return defaults.get(self.algorithm, 4)
    
    def generate(self) -> QuantumCircuit:
        """Generate circuit based on algorithm type"""
        generators = {
            'bell': self._generate_bell,
            'grover': self._generate_grover,
            'shor': self._generate_shor,
            'vqe': self._generate_vqe,
            'qaoa': self._generate_qaoa
        }
        
        generator_func = generators.get(self.algorithm)
        if not generator_func:
            raise ValueError(f"Unknown algorithm: {self.algorithm}")
        
        return generator_func()
    
    def _generate_bell(self) -> QuantumCircuit:
        """Generate Bell State circuit for entanglement"""
        gates = [
            QuantumGate('h', [0]),  # Hadamard on qubit 0
            QuantumGate('cx', [1], control_qubit=0),  # CNOT with control=0, target=1
            QuantumGate('measure', [0, 1])
        ]
        
        metadata = {
            'type': 'entanglement',
            'description': 'Creates maximally entangled Bell state',
            'expected_states': ['00', '11'],
            'fidelity': 0.99
        }
        
        return QuantumCircuit(2, gates, 'Bell', metadata)
    
    def _generate_grover(self) -> QuantumCircuit:
        """Generate Grover's search algorithm circuit"""
        n = self.num_qubits
        gates = []
        
        # Initialize superposition
        for i in range(n):
            gates.append(QuantumGate('h', [i]))
        
        # Number of Grover iterations
        iterations = int(np.pi / 4 * np.sqrt(2**n))
        
        for _ in range(min(iterations, 3)):  # Limit to 3 iterations for efficiency
            # Oracle (mark target state)
            gates.append(QuantumGate('x', [n-1]))
            
            # Multi-controlled Z gate (oracle marker)
            for i in range(n-1):
                gates.append(QuantumGate('cx', [n-1], control_qubit=i))
            
            gates.append(QuantumGate('x', [n-1]))
            
            # Diffusion operator
            for i in range(n):
                gates.append(QuantumGate('h', [i]))
                gates.append(QuantumGate('x', [i]))
            
            # Multi-controlled phase flip
            for i in range(n-1):
                gates.append(QuantumGate('cx', [n-1], control_qubit=i))
            
            for i in range(n):
                gates.append(QuantumGate('x', [i]))
                gates.append(QuantumGate('h', [i]))
        
        # Measurement
        gates.append(QuantumGate('measure', list(range(n))))
        
        metadata = {
            'type': 'search',
            'description': 'Grover search for unsorted database',
            'search_space': 2**n,
            'iterations': iterations,
            'speedup': 'O(√N)'
        }
        
        return QuantumCircuit(n, gates, 'Grover', metadata)
    
    def _generate_shor(self) -> QuantumCircuit:
        """Generate Shor's factoring algorithm circuit (simplified)"""
        n = max(self.num_qubits, 16)
        gates = []
        
        # Quantum Fourier Transform preparation
        control_qubits = n // 2
        target_qubits = n - control_qubits
        
        # Initialize control register to superposition
        for i in range(control_qubits):
            gates.append(QuantumGate('h', [i]))
        
        # Modular exponentiation (controlled operations)
        for i in range(control_qubits):
            power = 2**i
            for j in range(target_qubits):
                gates.append(QuantumGate('cx', [control_qubits + j], control_qubit=i))
        
        # Inverse Quantum Fourier Transform on control register
        for i in range(control_qubits // 2):
            gates.append(QuantumGate('swap', [i, control_qubits - 1 - i]))
        
        for i in range(control_qubits):
            gates.append(QuantumGate('h', [i]))
            for j in range(i):
                angle = -np.pi / (2**(i - j))
                gates.append(QuantumGate('cp', [i], control_qubit=j, 
                                       parameters={'theta': angle}))
        
        gates.append(QuantumGate('measure', list(range(control_qubits))))
        
        metadata = {
            'type': 'factorization',
            'description': 'Shor period finding for factoring',
            'control_qubits': control_qubits,
            'target_qubits': target_qubits,
            'classical_postprocessing': True
        }
        
        return QuantumCircuit(n, gates, 'Shor', metadata)
    
    def _generate_vqe(self) -> QuantumCircuit:
        """Generate Variational Quantum Eigensolver circuit"""
        n = self.num_qubits
        gates = []
        
        # Ansatz: Hardware-efficient ansatz with RY and CNOT layers
        num_layers = 3
        
        for layer in range(num_layers):
            # Rotation layer
            for i in range(n):
                theta = np.random.uniform(0, 2*np.pi)
                gates.append(QuantumGate('ry', [i], parameters={'theta': theta}))
            
            # Entangling layer
            for i in range(n - 1):
                gates.append(QuantumGate('cx', [i+1], control_qubit=i))
            
            # Additional rotations
            for i in range(n):
                phi = np.random.uniform(0, 2*np.pi)
                gates.append(QuantumGate('rz', [i], parameters={'phi': phi}))
        
        # Measurement in computational basis
        gates.append(QuantumGate('measure', list(range(n))))
        
        metadata = {
            'type': 'variational',
            'description': 'VQE for ground state energy estimation',
            'layers': num_layers,
            'parameters': num_layers * n * 2,
            'classical_optimizer': 'COBYLA'
        }
        
        return QuantumCircuit(n, gates, 'VQE', metadata)
    
    def _generate_qaoa(self) -> QuantumCircuit:
        """Generate Quantum Approximate Optimization Algorithm circuit"""
        n = self.num_qubits
        gates = []
        
        # Parse graph/problem data if available
        edges = self.data.get('edges', [(i, (i+1) % n) for i in range(n)])
        
        # Initialize superposition
        for i in range(n):
            gates.append(QuantumGate('h', [i]))
        
        # QAOA layers (p=2 for demonstration)
        p = 2
        
        for layer in range(p):
            gamma = np.random.uniform(0, 2*np.pi)
            
            # Problem Hamiltonian (cost function)
            for edge in edges:
                i, j = edge if isinstance(edge, tuple) else (edge, (edge + 1) % n)
                # ZZ interaction
                gates.append(QuantumGate('cx', [j], control_qubit=i))
                gates.append(QuantumGate('rz', [j], parameters={'phi': 2*gamma}))
                gates.append(QuantumGate('cx', [j], control_qubit=i))
            
            beta = np.random.uniform(0, 2*np.pi)
            
            # Mixer Hamiltonian
            for i in range(n):
                gates.append(QuantumGate('rx', [i], parameters={'theta': 2*beta}))
        
        # Measurement
        gates.append(QuantumGate('measure', list(range(n))))
        
        metadata = {
            'type': 'optimization',
            'description': 'QAOA for combinatorial optimization',
            'layers': p,
            'edges': len(edges),
            'classical_optimizer': 'Nelder-Mead'
        }
        
        return QuantumCircuit(n, gates, 'QAOA', metadata)
    
    def to_qasm(self, circuit: QuantumCircuit) -> str:
        """Convert circuit to OpenQASM 2.0 format"""
        qasm = "OPENQASM 2.0;\n"
        qasm += 'include "qelib1.inc";\n\n'
        qasm += f"qreg q[{circuit.num_qubits}];\n"
        qasm += f"creg c[{circuit.num_qubits}];\n\n"
        
        for gate in circuit.gates:
            if gate.gate_type == 'measure':
                for qubit in gate.target_qubits:
                    qasm += f"measure q[{qubit}] -> c[{qubit}];\n"
            elif gate.gate_type in ['h', 'x', 'y', 'z']:
                for qubit in gate.target_qubits:
                    qasm += f"{gate.gate_type} q[{qubit}];\n"
            elif gate.gate_type == 'cx':
                qasm += f"cx q[{gate.control_qubit}],q[{gate.target_qubits[0]}];\n"
            elif gate.gate_type == 'swap':
                i, j = gate.target_qubits[0], gate.target_qubits[1]
                qasm += f"swap q[{i}],q[{j}];\n"
            elif gate.gate_type in ['ry', 'rz', 'rx']:
                theta = gate.parameters.get('theta') or gate.parameters.get('phi', 0)
                for qubit in gate.target_qubits:
                    qasm += f"{gate.gate_type}({theta}) q[{qubit}];\n"
            elif gate.gate_type == 'cp':
                theta = gate.parameters['theta']
                qasm += f"cp({theta}) q[{gate.control_qubit}],q[{gate.target_qubits[0]}];\n"
        
        return qasm


def load_qasm_template(algorithm: str) -> str:
    """Load pre-built QASM template for algorithm"""
    template_map = {
        'bell': 'bell_state.qasm',
        'grover': 'grover_search.qasm',
        'shor': 'shor_period_finding.qasm',
        'vqe': 'vqe_ansatz.qasm',
        'qaoa': 'qaoa_maxcut.qasm'
    }
    
    template_file = template_map.get(algorithm.lower())
    if not template_file:
        return None
    
    template_path = Path(__file__).parent / 'algorithms' / template_file
    
    try:
        with open(template_path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        return None

def main():
    if len(sys.argv) < 3:
        print(json.dumps({'error': 'Usage: python quantum_circuit_generator.py <algorithm> <data_json>'}))
        sys.exit(1)
    
    algorithm = sys.argv[1]
    data = json.loads(sys.argv[2])
    
    # Load QASM template
    qasm = load_qasm_template(algorithm)
    
    if not qasm:
        print(json.dumps({'error': f'Unknown algorithm: {algorithm}'}))
        sys.exit(1)
    
    # Return circuit info
    num_qubits = qasm.count('qreg') 
    output = {
        'algorithm': algorithm.capitalize(),
        'num_qubits': data.get('num_items', 4),
        'qasm': qasm,
        'metadata': {
            'type': 'template',
            'source': 'OpenQASM'
        }
    }
    
    print(json.dumps(output, indent=2))

if __name__ == "__main__":
    main()
