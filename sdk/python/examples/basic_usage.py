"""
Basic usage example for Planck SDK

Installation:
    pip install planck_sdk

This example demonstrates:
1. Initializing the client
2. Running a quantum circuit
3. Viewing results
4. Generating circuits without executing
5. Getting ML recommendations
6. Transpiling circuits
7. Visualizing circuits
8. Getting digital twin insights
"""

import os
from planck_sdk import PlanckUser, AuthenticationError, CircuitError, APIError

# Get API key from environment or use directly
API_KEY = os.environ.get("PLANCK_API_KEY", "your_api_key_here")


def main():
    # Initialize user
    print("Initializing Planck user...")
    
    try:
        user = PlanckUser(api_key=API_KEY)
    except AuthenticationError as e:
        print(f"Authentication error: {e}")
        print("Please set PLANCK_API_KEY environment variable or provide a valid API key")
        return
    
    # Test connection
    print("Testing connection...")
    if not user.ping():
        print("Failed to connect to Planck API. Check your API key and internet connection.")
        return
    
    print("Connected successfully!\n")
    
    # Example 1: Run a simple Bell state circuit
    print("=" * 60)
    print("Example 1: Bell State Circuit")
    print("=" * 60)
    
    try:
        result = user.run(
            data=[1, 0],  # Simple input data
            algorithm="bell",
            shots=2048
        )
        
        print(f"Execution ID: {result.execution_id}")
        print(f"Backend: {result.backend}")
        print(f"Runtime: {result.runtime_ms:.2f}ms")
        print(f"Fidelity: {result.fidelity:.3f}")
        print(f"\nMeasurement counts:")
        for state, count in sorted(result.counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            prob = count / result.shots * 100
            print(f"  |{state}>: {count} ({prob:.1f}%)")
    except CircuitError as e:
        print(f"Circuit error: {e}")
    except APIError as e:
        print(f"API error: {e}")
    
    # Example 2: VQE for optimization
    print("\n" + "=" * 60)
    print("Example 2: VQE Algorithm")
    print("=" * 60)
    
    try:
        result = user.run(
            data=[1.0, 2.0, 3.0, 4.0],
            algorithm="vqe",
            shots=1024,
            backend="auto",
            error_mitigation="medium"
        )
        
        result.plot_histogram(top_n=5)
    except (CircuitError, APIError) as e:
        print(f"Error: {e}")
    
    # Example 3: Generate circuit without executing
    print("\n" + "=" * 60)
    print("Example 3: Circuit Generation (Grover)")
    print("=" * 60)
    
    try:
        circuit = user.generate_circuit(
            data=[1, 2, 3, 4, 5, 6, 7, 8],
            algorithm="grover",
            qubits=3
        )
        
        print(f"Generated circuit:")
        print(f"  Qubits: {circuit.qubits}")
        print(f"  Depth: {circuit.depth}")
        print(f"  Gates: {circuit.gate_count}")
        print(f"  Recommended shots: {circuit.recommended_shots}")
        print(f"\nQASM code (first 10 lines):")
        print("\n".join(circuit.qasm.split("\n")[:10]))
        
        # Save circuit
        circuit.save("grover_circuit.qasm")
        print("\nCircuit saved to grover_circuit.qasm")
    except CircuitError as e:
        print(f"Circuit error: {e}")
    
    # Example 4: Get ML recommendations
    print("\n" + "=" * 60)
    print("Example 4: ML Recommendations")
    print("=" * 60)
    
    try:
        recommendations = user.get_recommendations(
            qubits=8,
            depth=20,
            gate_count=50,
            algorithm="qaoa",
            data_size=100
        )
        
        print(f"ML Recommendations:")
        print(f"  Shots: {recommendations['recommended_shots']}")
        print(f"  Backend: {recommendations['recommended_backend']}")
        print(f"  Error Mitigation: {recommendations['recommended_error_mitigation']}")
        print(f"  Confidence: {recommendations['confidence']:.2%}")
        print(f"  Based on {recommendations['based_on_executions']} executions")
    except APIError as e:
        print(f"API error: {e}")
    
    # Example 5: Transpile circuit
    print("\n" + "=" * 60)
    print("Example 5: Circuit Transpilation")
    print("=" * 60)
    
    try:
        # Generate a circuit first
        circuit = user.generate_circuit(
            data=[1, 2, 3],
            algorithm="bell",
            qubits=2
        )
        
        # Transpile for quantum hardware
        transpiled = user.transpile(
            qasm=circuit.qasm,
            backend="quantum_qpu",
            qubits=2
        )
        
        print(f"Transpilation results:")
        print(f"  Swap count: {transpiled['swap_count']}")
        print(f"  New depth: {transpiled['depth']}")
        print(f"  Qubit mapping: {transpiled['mapped_qubits']}")
    except (CircuitError, APIError) as e:
        print(f"Error: {e}")
    
    # Example 6: Visualize circuit
    print("\n" + "=" * 60)
    print("Example 6: Circuit Visualization")
    print("=" * 60)
    
    try:
        circuit = user.generate_circuit(
            data=[1, 0],
            algorithm="bell",
            qubits=2
        )
        
        viz = user.visualize(qasm=circuit.qasm)
        
        print(f"Visualization generated:")
        print(f"  Format: {viz['format']}")
        print(f"  Width: {viz['width']}px")
        print(f"  Height: {viz['height']}px")
        print(f"  Stats: {viz['stats']}")
        
        # Save SVG to file
        with open("circuit_visualization.svg", "w") as f:
            f.write(viz["image_data"])
        print("  Saved to circuit_visualization.svg")
    except (CircuitError, APIError) as e:
        print(f"Error: {e}")
    
    # Example 7: Get Digital Twin insights
    print("\n" + "=" * 60)
    print("Example 7: Digital Twin Insights")
    print("=" * 60)
    
    try:
        # First run a circuit
        result = client.run(
            data=[1, 2, 3, 4],
            algorithm="vqe",
            shots=1024
        )
        
        # Get insights
        insights = user.get_digital_twin(
            algorithm="vqe",
            circuit_info={
                "qubits": result.circuit.qubits if result.circuit else 4,
                "gates": result.circuit.gate_count if result.circuit else 10,
                "depth": result.circuit.depth if result.circuit else 5
            },
            execution_results={
                "probabilities": result.probabilities,
                "counts": result.counts,
                "execution_id": result.execution_id
            },
            backend_config={
                "shots": result.shots,
                "errorMitigation": "medium"
            }
        )
        
        print(f"Digital Twin Analysis:")
        print(f"  Interpretation: {insights.get('algorithm_interpretation', 'N/A')}")
        print(f"  Key Findings:")
        for finding in insights.get('key_findings', [])[:3]:
            print(f"    - {finding}")
        print(f"  Recommendations:")
        for rec in insights.get('recommendations', [])[:2]:
            print(f"    - {rec}")
    except (CircuitError, APIError) as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 60)
    print("Examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
