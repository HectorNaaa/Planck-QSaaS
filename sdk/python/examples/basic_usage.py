"""
Basic usage example for Planck SDK

This example demonstrates:
1. Initializing the client
2. Running a quantum circuit
3. Viewing results
4. Generating circuits without executing
"""

import os
from planck_sdk import PlanckClient

# Get API key from environment or use directly
API_KEY = os.environ.get("PLANCK_API_KEY", "your_api_key_here")

def main():
    # Initialize client
    print("Initializing Planck client...")
    client = PlanckClient(api_key=API_KEY)
    
    # Test connection
    if not client.ping():
        print("Failed to connect to Planck API. Check your API key and internet connection.")
        return
    
    print("Connected successfully!\n")
    
    # Example 1: Run a simple Bell state circuit
    print("=" * 60)
    print("Example 1: Bell State Circuit")
    print("=" * 60)
    
    result = client.run(
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
    
    # Example 2: VQE for optimization
    print("\n" + "=" * 60)
    print("Example 2: VQE Algorithm")
    print("=" * 60)
    
    result = client.run(
        data=[1.0, 2.0, 3.0, 4.0],
        algorithm="vqe",
        shots=1024,
        backend="auto"
    )
    
    result.plot_histogram(top_n=5)
    
    # Example 3: Generate circuit without executing
    print("\n" + "=" * 60)
    print("Example 3: Circuit Generation (Grover)")
    print("=" * 60)
    
    circuit = client.generate_circuit(
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
    
    # Example 4: Get ML recommendations
    print("\n" + "=" * 60)
    print("Example 4: ML Recommendations")
    print("=" * 60)
    
    recommendations = client.get_recommendations(
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
    
    print("\n" + "=" * 60)
    print("Examples completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
