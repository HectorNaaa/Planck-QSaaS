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
from planck_sdk import PlanckUser
import os

# Set your API key (get it from https://plancktechnologies.xyz/qsaas/settings)
API_KEY = "your_api_key_here"  # Or use: os.environ.get("PLANCK_API_KEY")

# Initialize client (PlanckClient is an alias for PlanckUser, both work)
user = PlanckUser(
    api_key=API_KEY,
    base_url="https://plancktechnologies.xyz",
)

# Test connection
print("Testing connection...")
if user.ping():
    health = user.health_check()
    print(f"Connected to Planck API v{health.get('version', 'unknown')}!")
else:
    print("Connection issue. Check your API key.")

# =============================================================================
# Cell 3: Simple Bell State (generate + run)
# =============================================================================
result = user.run(
    data=[1, 0],
    algorithm="bell",
    shots=2048,
)

print("Bell State Results:")
print(f"  Counts: {result.counts}")
print(f"  Runtime: {result.runtime_ms:.2f}ms")
print(f"  Fidelity: {result.fidelity:.3f}")

# =============================================================================
# Cell 4: VQE for Optimization
# =============================================================================
result = user.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",
    shots=1024,
)

print("VQE Results:")
print(f"  Fidelity: {result.fidelity:.3f}")
print(f"  Counts: {result.counts}")

# =============================================================================
# Cell 5: Grover's Search
# =============================================================================
result = user.run(
    data=[1, 0, 1, 0, 1, 0, 1, 0],
    algorithm="grover",
    shots=2048,
    qubits=3,
)

print("Grover Search Results:")
print(f"  Counts: {result.counts}")

# Find most frequent state
most_frequent = max(result.counts.items(), key=lambda x: x[1])
print(f"  Most frequent: |{most_frequent[0]}> ({most_frequent[1]} times)")

# =============================================================================
# Cell 6: QAOA for Optimization
# =============================================================================
result = user.run(
    data=[2.5, 3.1, 1.7, 4.2],
    algorithm="qaoa",
    shots=1024,
    qubits=4,
)

print("QAOA Results:")
print(f"  Counts: {result.counts}")

# =============================================================================
# Cell 7: Custom QASM Circuit (simulate directly)
# =============================================================================
custom_qasm = """OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
h q[0];
h q[1];
h q[2];
cx q[0], q[1];
cx q[1], q[2];
measure q -> c;"""

result = user.simulate(
    qasm=custom_qasm,
    shots=1024,
    backend="auto",
    error_mitigation="medium",
)

print("Custom Circuit Results:")
print(f"  Counts: {result.counts}")
print(f"  Runtime: {result.runtime_ms:.2f}ms")

# =============================================================================
# Cell 8: ML Recommendations
# =============================================================================
recommendations = user.get_recommendations(
    qubits=6,
    depth=15,
    gate_count=40,
    algorithm="qaoa",
    data_size=200,
)

print("ML Recommendations:")
print(f"  Backend: {recommendations.get('recommended_backend', 'N/A')}")
print(f"  Shots: {recommendations.get('recommended_shots', 'N/A')}")
print(f"  Error mitigation: {recommendations.get('recommended_error_mitigation', 'N/A')}")
print(f"  Confidence: {recommendations.get('confidence', 0):.1%}")

# =============================================================================
# Cell 9: Digital Twin Analysis
# =============================================================================
# Run a circuit first
run_result = user.run(
    data=[1, 2, 3, 4],
    algorithm="vqe",
    shots=1024,
)

twin = user.get_digital_twin(
    algorithm="vqe",
    circuit_info={
        "qubits": run_result.circuit.qubits if run_result.circuit else 4,
        "gates": run_result.circuit.gate_count if run_result.circuit else 10,
        "depth": run_result.circuit.depth if run_result.circuit else 5,
    },
    execution_results={
        "probabilities": run_result.probabilities,
        "counts": run_result.counts,
        "execution_id": run_result.execution_id,
    },
    backend_config={
        "shots": run_result.shots,
        "errorMitigation": "medium",
    },
)

print("Digital Twin Analysis:")
print(f"  Interpretation: {twin.get('algorithm_interpretation', 'N/A')}")

# =============================================================================
# Cell 10: Transpile Circuit
# =============================================================================
circuit = user.generate_circuit(
    data=[1, 0],
    algorithm="bell",
    qubits=2,
)

transpiled = user.transpile(
    qasm=circuit.qasm,
    backend="quantum_qpu",
    qubits=2,
)

print("Transpiled Circuit:")
print(f"  Swap count: {transpiled['swap_count']}")
print(f"  Depth: {transpiled['depth']}")
print(f"  Mapped qubits: {transpiled['mapped_qubits']}")

# =============================================================================
# Cell 11: Visualize Results (requires matplotlib)
# =============================================================================
try:
    import matplotlib.pyplot as plt

    # Get fresh results
    result = user.simulate(qasm=custom_qasm, shots=1024)

    # Plot histogram
    states = list(result.counts.keys())
    counts = list(result.counts.values())

    plt.figure(figsize=(10, 6))
    plt.bar(states, counts, color="steelblue", edgecolor="black")
    plt.xlabel("Quantum State")
    plt.ylabel("Counts")
    plt.title("Quantum Circuit Measurement Results")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()

except ImportError:
    print("matplotlib not installed - run: pip install matplotlib")
