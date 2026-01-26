"""
Jupyter Notebook Example for Planck SDK
========================================

Copy these cells into a Jupyter notebook to get started quickly.

Installation:
    pip install planck_sdk
"""

# =============================================================================
# Cell 1: Installation
# =============================================================================
# Run this cell first to install the SDK
# !pip install -q planck_sdk
# print("Planck SDK installed!")

# =============================================================================
# Cell 2: Import and Setup
# =============================================================================
from planck_sdk import PlanckClient
import os

# Set your API key (get it from https://planck.plancktechnologies.xyz/qsaas/settings)
API_KEY = "your_api_key_here"  # Or use: os.environ.get("PLANCK_API_KEY")

# Initialize client
client = PlanckClient(
    api_key=API_KEY,
    base_url="https://planck.plancktechnologies.xyz"
)

# Test connection
print("Testing connection...")
health = client.health_check()
if health.get("status") == "healthy":
    print(f"Connected to Planck API v{health.get('version', 'unknown')}!")
else:
    print("Connection issue. Check your API key.")

# =============================================================================
# Cell 3: Simple Bell State
# =============================================================================
circuit = client.generate_circuit(
    algorithm="bell_state",
    num_qubits=2
)

result = client.simulate(
    qasm=circuit.qasm,
    shots=2048
)

print(f"Bell State Results:")
print(f"  Counts: {result.counts}")
print(f"  Runtime: {result.execution_time_ms:.2f}ms")

# =============================================================================
# Cell 4: VQE for Optimization
# =============================================================================
result = client.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",
    shots=1024
)

print(f"VQE Results:")
print(f"  Fidelity: {result.fidelity:.3f}")
print(f"  Counts: {result.counts}")

# =============================================================================
# Cell 5: Grover's Search
# =============================================================================
circuit = client.generate_circuit(
    algorithm="grover",
    num_qubits=3,
    parameters={"marked_state": "101"}
)

result = client.simulate(
    qasm=circuit.qasm,
    shots=2048
)

print(f"Grover Search Results:")
print(f"  Looking for: |101>")
print(f"  Counts: {result.counts}")

# Find most frequent state
most_frequent = max(result.counts.items(), key=lambda x: x[1])
print(f"  Most frequent: |{most_frequent[0]}> ({most_frequent[1]} times)")

# =============================================================================
# Cell 6: QAOA for Optimization
# =============================================================================
circuit = client.generate_circuit(
    algorithm="qaoa",
    num_qubits=4,
    parameters={"layers": 2, "gamma": 0.5, "beta": 0.3}
)

result = client.simulate(
    qasm=circuit.qasm,
    shots=1024
)

print(f"QAOA Results:")
print(f"  Counts: {result.counts}")

# =============================================================================
# Cell 7: Custom QASM Circuit
# =============================================================================
custom_qasm = """
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
h q[0];
h q[1];
h q[2];
cx q[0], q[1];
cx q[1], q[2];
measure q -> c;
"""

result = client.simulate(
    qasm=custom_qasm,
    shots=1024
)

print(f"Custom Circuit Results:")
print(f"  Counts: {result.counts}")

# =============================================================================
# Cell 8: ML Recommendations
# =============================================================================
recommendations = client.get_ml_recommendations(
    circuit_depth=15,
    num_qubits=6,
    gate_types=["h", "cx", "rz", "ry"]
)

print("ML Recommendations:")
print(f"  Backend: {recommendations.get('recommended_backend', 'N/A')}")
print(f"  Confidence: {recommendations.get('confidence', 0):.1%}")

# =============================================================================
# Cell 9: Digital Twin Analysis
# =============================================================================
twin = client.create_digital_twin(
    qasm=custom_qasm,
    hardware_profile={
        "backend": "ibm_simulator",
        "t1": 50e-6,
        "t2": 70e-6,
        "gate_error": 0.001
    }
)

print("Digital Twin Analysis:")
print(f"  Ideal fidelity: {twin.get('ideal_fidelity', 'N/A')}")
print(f"  Noisy fidelity: {twin.get('noisy_fidelity', 'N/A')}")

# =============================================================================
# Cell 10: Transpile Circuit
# =============================================================================
transpiled = client.transpile(
    qasm=custom_qasm,
    target_backend="ibm_simulator",
    optimization_level=2
)

print("Transpiled Circuit:")
print(f"  Original depth: {transpiled.get('original_depth', 'N/A')}")
print(f"  Optimized depth: {transpiled.get('optimized_depth', 'N/A')}")

# =============================================================================
# Cell 11: Ask the AI Assistant
# =============================================================================
answer = client.ask("What is VQE and when should I use it?")
print(f"AI Assistant Answer:\n{answer}")

# =============================================================================
# Cell 12: Visualize Results (requires matplotlib)
# =============================================================================
try:
    import matplotlib.pyplot as plt
    
    # Get fresh results
    result = client.simulate(qasm=custom_qasm, shots=1024)
    
    # Plot histogram
    states = list(result.counts.keys())
    counts = list(result.counts.values())
    
    plt.figure(figsize=(10, 6))
    plt.bar(states, counts, color='steelblue', edgecolor='black')
    plt.xlabel('Quantum State')
    plt.ylabel('Counts')
    plt.title('Quantum Circuit Measurement Results')
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()
    
except ImportError:
    print("matplotlib not installed - run: pip install matplotlib")
