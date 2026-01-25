"""
Jupyter Notebook Example for Planck SDK

Copy these cells into a Jupyter notebook to get started quickly.
"""

# Cell 1: Installation
"""
# Install Planck SDK
!pip install planck-sdk

# Or install from source
!pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
"""

# Cell 2: Import and Setup
from planck_sdk import PlanckClient
import os

# Set your API key
API_KEY = "your_api_key_here"  # Or use: os.environ.get("PLANCK_API_KEY")

# Initialize client
client = PlanckClient(api_key=API_KEY)

# Test connection
print("Testing connection...")
if client.ping():
    print("✓ Connected to Planck API successfully!")
else:
    print("✗ Connection failed. Check your API key.")

# Cell 3: Simple Bell State
result = client.run(
    data=[1, 0],
    algorithm="bell",
    shots=2048
)

print(f"Execution ID: {result.execution_id}")
print(f"Runtime: {result.runtime_ms:.2f}ms")
result.plot_histogram()

# Cell 4: VQE for Optimization
result = client.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",
    shots=1024
)

print(f"Fidelity: {result.fidelity:.3f}")
result.plot_histogram(top_n=10)

# Cell 5: Grover's Search
result = client.run(
    data=list(range(1, 17)),  # Search space of 16 items
    algorithm="grover",
    shots=2048
)

print(f"Most frequent state: |{result.most_frequent}>")
print(f"Success rate: {result.success_rate:.1f}%")
result.plot_histogram()

# Cell 6: QAOA for Optimization
import random
random.seed(42)

# Generate random optimization problem data
data = [[random.random() for _ in range(5)] for _ in range(10)]

result = client.run(
    data=data,
    algorithm="qaoa",
    shots=1024,
    backend="auto"
)

result.plot_histogram()

# Cell 7: Generate Circuit Only
circuit = client.generate_circuit(
    data=[1, 2, 3, 4],
    algorithm="grover",
    qubits=4
)

print(f"Circuit: {circuit}")
print(f"\nQASM code:")
print(circuit.qasm)

# Cell 8: ML Recommendations
recommendations = client.get_recommendations(
    qubits=6,
    depth=15,
    gate_count=40,
    algorithm="vqe",
    data_size=50
)

print("ML Recommendations:")
for key, value in recommendations.items():
    print(f"  {key}: {value}")

# Cell 9: Load Data from File
# First, create a sample CSV file
with open("sample_data.csv", "w") as f:
    f.write("x,y,z\n")
    for i in range(10):
        f.write(f"{i},{i*2},{i*3}\n")

# Load and run
result = client.run(
    data="sample_data.csv",
    algorithm="vqe",
    shots=1024
)

result.plot_histogram()

# Cell 10: Save Results
# Save result to JSON
result.save("my_execution_result.json")

# Save circuit QASM
if result.circuit:
    result.circuit.save("my_circuit.qasm")

print("Results saved!")

# Cell 11: List Previous Executions
executions = client.list_executions(limit=10)

print(f"Your last {len(executions)} executions:")
for i, exec in enumerate(executions, 1):
    print(f"{i}. {exec.get('id')}: {exec.get('algorithm')} - {exec.get('status')}")

# Cell 12: Ask the AI Assistant
answer = client.ask("What is VQE and when should I use it?")
print(answer)

answer = client.ask("What was my average runtime in my last 5 executions?")
print(answer)
