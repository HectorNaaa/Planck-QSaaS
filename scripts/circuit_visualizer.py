"""
Quantum Circuit Visualizer
Generates circuit diagrams as images from QASM code using matplotlib and qiskit
"""

import json
import sys
import base64
from io import BytesIO
from typing import Dict, Any

try:
    import matplotlib
    matplotlib.use('Agg')  # Use non-interactive backend
    import matplotlib.pyplot as plt
    from qiskit import QuantumCircuit
    from qiskit.visualization import circuit_drawer
except ImportError:
    print(json.dumps({
        'success': False,
        'error': 'Missing dependencies: qiskit or matplotlib'
    }))
    sys.exit(1)


class CircuitVisualizer:
    """Generates visual representations of quantum circuits"""
    
    def __init__(self, qasm_code: str):
        self.qasm_code = qasm_code
        self.circuit = None
        
    def parse_circuit(self) -> bool:
        """Parse QASM code into Qiskit circuit"""
        try:
            self.circuit = QuantumCircuit.from_qasm_str(self.qasm_code)
            return True
        except Exception as e:
            print(json.dumps({
                'success': False,
                'error': f'Failed to parse QASM: {str(e)}'
            }), file=sys.stderr)
            return False
    
    def generate_image(self, output_format: str = 'png') -> Dict[str, Any]:
        """Generate circuit diagram image"""
        if not self.circuit:
            if not self.parse_circuit():
                return {'success': False, 'error': 'Invalid circuit'}
        
        try:
            # Create figure with appropriate size
            fig = circuit_drawer(
                self.circuit,
                output='mpl',
                style={'backgroundcolor': '#FFFFFF'},
                plot_barriers=True,
                fold=20  # Fold circuit if too wide
            )
            
            # Save to bytes buffer
            buffer = BytesIO()
            plt.savefig(buffer, format=output_format, dpi=300, bbox_inches='tight')
            buffer.seek(0)
            
            # Convert to base64 for easy transmission
            image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
            plt.close()
            
            return {
                'success': True,
                'image_data': image_base64,
                'format': output_format,
                'width': fig.get_figwidth() * fig.dpi,
                'height': fig.get_figheight() * fig.dpi,
                'num_qubits': self.circuit.num_qubits,
                'depth': self.circuit.depth()
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to generate image: {str(e)}'
            }
    
    def get_circuit_stats(self) -> Dict[str, Any]:
        """Extract circuit statistics"""
        if not self.circuit:
            if not self.parse_circuit():
                return {}
        
        # Count gate types
        gate_counts = {}
        for instruction, qargs, cargs in self.circuit.data:
            gate_name = instruction.name
            gate_counts[gate_name] = gate_counts.get(gate_name, 0) + 1
        
        return {
            'num_qubits': self.circuit.num_qubits,
            'num_clbits': self.circuit.num_clbits,
            'depth': self.circuit.depth(),
            'size': self.circuit.size(),
            'gate_counts': gate_counts,
            'num_parameters': self.circuit.num_parameters
        }


def parse_qasm_stats(qasm_code: str) -> dict:
    """Extract basic statistics from QASM code"""
    lines = qasm_code.strip().split('\n')
    
    stats = {
        'num_qubits': 0,
        'num_gates': 0,
        'gate_types': {},
        'depth': 0
    }
    
    for line in lines:
        line = line.strip()
        if line.startswith('qreg'):
            # Extract qubit count: qreg q[4];
            num = int(line.split('[')[1].split(']')[0])
            stats['num_qubits'] = max(stats['num_qubits'], num)
        elif line and not line.startswith('//') and not line.startswith('OPENQASM') and not line.startswith('include'):
            # Count gates
            gate = line.split()[0].split('(')[0]
            if gate in ['h', 'x', 'y', 'z', 'cx', 'measure', 'ry', 'rz', 'rx']:
                stats['num_gates'] += 1
                stats['gate_types'][gate] = stats['gate_types'].get(gate, 0) + 1
    
    stats['depth'] = stats['num_gates']  # Simplified depth calculation
    
    return stats

def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: python circuit_visualizer.py <qasm_code>'
        }))
        sys.exit(1)
    
    qasm_code = sys.argv[1]
    visualizer = CircuitVisualizer(qasm_code)
    
    # Generate image
    result = visualizer.generate_image('png')
    
    # Add circuit stats
    if result['success']:
        result['stats'] = visualizer.get_circuit_stats()
    else:
        result['stats'] = parse_qasm_stats(qasm_code)
    
    print(json.dumps(result))


if __name__ == "__main__":
    main()
