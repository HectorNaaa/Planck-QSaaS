# Planck SDK for Python

Official Python SDK for the Planck Quantum Digital Twins Platform.

## Installation

### Direct Install from GitHub (Recommended for Colab/Remote)

Install directly without cloning - works in Google Colab, Jupyter, or any Python environment:

\`\`\`bash
pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
\`\`\`

**Google Colab / Jupyter Notebook:**
\`\`\`python
!pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
\`\`\`

### From PyPI (when published)

\`\`\`bash
pip install planck-sdk
\`\`\`

### From Source (for development)

\`\`\`bash
# Clone the repository
git clone https://github.com/HectorNaaa/Planck-QSaaS.git
cd Planck-QSaaS/sdk/python

# Install in development mode
pip install -e .
\`\`\`

## Rate Limits & Restrictions

To ensure fair usage and prevent abuse, the Planck API enforces the following limits:

- **Request Rate**: Maximum 1 request every 3 seconds per user
- **Payload Size**: Maximum 1mb per request

The SDK automatically handles these limits:
- Automatically waits 3 seconds between requests
- Validates payload size before sending
- Provides clear error messages if limits are exceeded

If you exceed the rate limit, you'll receive an `APIError` with retry-after information.

## Getting Your API Key

1. Sign up at [https://planck.plancktechnologies.xyz](https://planck.plancktechnologies.xyz)
2. Navigate to Settings > API Keys
3. Generate a new API key
4. Copy and save it securely (it won't be shown again)

## Quick Start

\`\`\`python
from planck_sdk import PlanckClient

# Initialize client with your API key
client = PlanckClient(
    api_key="your_api_key_here",
    base_url="https://planck.plancktechnologies.xyz"  # Optional, this is the default
)

# Run a quantum circuit with your data
result = client.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",
    shots=2048
)

# View results
print(result.counts)
print(f"Fidelity: {result.fidelity:.3f}")
print(f"Runtime: {result.runtime_ms:.1f}ms")

# Plot histogram
result.plot_histogram()

# Save results
result.save("my_execution.json")
\`\`\`

## Available Algorithms

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| `vqe` | Variational Quantum Eigensolver | Optimization, Chemistry |
| `grover` | Grover's Search | Database search, SAT |
| `qaoa` | Quantum Approximate Optimization | Combinatorial optimization |
| `qft` | Quantum Fourier Transform | Signal processing |
| `bell` | Bell State Preparation | Entanglement, Testing |

## Loading Data

\`\`\`python
# From a list
result = client.run(data=[1, 2, 3, 4])

# From a dictionary
result = client.run(data={"values": [1, 2, 3], "weights": [0.5, 0.3, 0.2]})

# From a file
result = client.run(data="path/to/data.csv")
result = client.run(data="path/to/data.json")
\`\`\`

## Advanced Usage

### Generate Circuit Without Executing

\`\`\`python
circuit = client.generate_circuit(
    data=[1, 2, 3, 4],
    algorithm="grover",
    qubits=4
)

print(circuit.qasm)
print(f"Depth: {circuit.depth}")
print(f"Gates: {circuit.gate_count}")

# Save QASM to file
circuit.save("my_circuit.qasm")
\`\`\`

### Get ML Recommendations

\`\`\`python
recommendations = client.get_recommendations(
    qubits=8,
    depth=20,
    gate_count=50,
    algorithm="vqe",
    data_size=100
)

print(f"Recommended shots: {recommendations['recommended_shots']}")
print(f"Recommended backend: {recommendations['recommended_backend']}")
print(f"Confidence: {recommendations['confidence']:.2f}")
\`\`\`

### Custom Backend Selection

\`\`\`python
# Force specific backend
result = client.run(
    data=my_data,
    algorithm="qaoa",
    backend="quantum_qpu",  # Options: auto, classical, hpc, quantum_qpu
    error_mitigation="high"  # Options: none, low, medium, high
)
\`\`\`

### List Previous Executions

\`\`\`python
executions = client.list_executions(limit=20)

for exec in executions:
    print(f"{exec['id']}: {exec['algorithm']} - {exec['status']}")
\`\`\`

### Retrieve Specific Execution

\`\`\`python
result = client.get_execution("execution_id_here")
print(result.to_json())
\`\`\`

## Error Handling

\`\`\`python
from planck_sdk import PlanckClient, AuthenticationError, CircuitError, APIError

try:
    client = PlanckClient(api_key="invalid_key")
    result = client.run(data=[1, 2, 3])
except AuthenticationError as e:
    print(f"Auth failed: {e}")
except CircuitError as e:
    print(f"Circuit error: {e}")
except APIError as e:
    print(f"API error: {e}")
\`\`\`

## Environment Variables

You can also set your API key via environment variable:

\`\`\`bash
export PLANCK_API_KEY="sk_live_your_api_key"
\`\`\`

\`\`\`python
import os
from planck_sdk import PlanckClient

client = PlanckClient(api_key=os.environ["PLANCK_API_KEY"])
\`\`\`

## Support

- Platform: https://planck.plancktechnologies.xyz
- GitHub: https://github.com/HectorNaaa/Planck-QSaaS
- Email: hello@plancktechnologies.xyz
