# Planck SDK for Python

Official lightweight Python SDK for the Planck Quantum Digital Twins Platform.  
**Zero dependencies** - uses only Python standard library.

## Installation

### Standard Installation (Recommended)

```bash
pip install planck_sdk
```

### From GitHub (Development)

```bash
pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
```

### Google Colab / Jupyter Notebook

```python
# Install Planck SDK (run this cell once)
!pip install -q planck_sdk
print("Planck SDK installed!")
```

## Verify Installation

```python
import planck_sdk
print(f"Planck SDK v{planck_sdk.__version__}")
# Should print: Planck SDK v1.0.0
```

## Rate Limits & Restrictions

To ensure fair usage and prevent abuse, the Planck API enforces the following limits:

- **Request Rate**: Maximum 1 request every 3 seconds per user
- **Payload Size**: Maximum 1MB per request

The SDK automatically handles these limits:
- Automatically waits 3 seconds between requests
- Validates payload size before sending
- Provides clear error messages if limits are exceeded

If you exceed the rate limit, you'll receive an `APIError` with retry-after information.

## Getting Your API Key

1. Sign up at [https://plancktechnologies.xyz](https://plancktechnologies.xyz)
2. Navigate to Settings > API Keys
3. Generate a new API key (v0.9 format: 64-character alphanumeric string)
4. Copy and save it securely (it won't be shown again)

**API Key Format (v0.9):**
- Pure alphanumeric hexadecimal string (64 characters)
- Example: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
- Old format with `plk_` prefix is no longer supported - please regenerate if you have an old key

## Quick Start (v0.9)

```python
from planck_sdk import PlanckUser

# Initialize user with your API key (new in v0.9)
user = PlanckUser(
    api_key="your_api_key_here",
    base_url="https://plancktechnologies.xyz"  # Optional, this is the default
)

# Run a quantum circuit with your data
result = user.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",
    shots=2048
)

# View results
print(result.counts)
print(f"Success Rate: {result.success_rate:.2f}%")
print(f"Runtime: {result.runtime_ms}ms")

# Plot histogram
result.plot_histogram()

# Save results
result.save("my_execution.json")
```

**Note:** `PlanckClient` is still supported for backwards compatibility, but `PlanckUser` is the recommended naming in v0.9.

## Available Algorithms

| Algorithm | Description | Best For |
|-----------|-------------|----------|
| `vqe` | Variational Quantum Eigensolver | Optimization, Chemistry |
| `grover` | Grover's Search | Database search, SAT |
| `qaoa` | Quantum Approximate Optimization | Combinatorial optimization |
| `qft` | Quantum Fourier Transform | Signal processing |
| `bell` | Bell State Preparation | Entanglement, Testing |
| `shor` | Shor's Algorithm | Factorization |

## Loading Data

```python
# From a list
result = client.run(data=[1, 2, 3, 4])

# From a dictionary
result = client.run(data={"values": [1, 2, 3], "weights": [0.5, 0.3, 0.2]})

# From a file
result = client.run(data="path/to/data.csv")
result = client.run(data="path/to/data.json")
```

## API Reference

### PlanckClient

Main client for interacting with the Planck API.

```python
client = PlanckClient(
    api_key="your_api_key",
    base_url="https://plancktechnologies.xyz",  # Optional
    timeout=60  # Optional, request timeout in seconds
)
```

### client.run()

Generate and execute a quantum circuit.

```python
result = client.run(
    data=[1.0, 2.0, 3.0, 4.0],  # Input data
    algorithm="vqe",            # Algorithm type
    shots=2048,                 # Number of measurements
    backend="auto",             # Backend selection
    error_mitigation="medium",  # Error mitigation level
    circuit_name="My Circuit",  # Optional name
    qubits=4                    # Optional qubit count
)
```

### client.generate_circuit()

Generate a quantum circuit without executing.

```python
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
```

### client.transpile()

Transpile a circuit for a specific backend topology.

```python
transpiled = client.transpile(
    qasm=circuit.qasm,
    backend="quantum_qpu",
    qubits=5
)

print(f"Swap count: {transpiled['swap_count']}")
print(f"New depth: {transpiled['depth']}")
```

### client.visualize()

Generate an SVG visualization of a circuit.

```python
viz = client.visualize(qasm=circuit.qasm)

# Save SVG to file
with open("circuit.svg", "w") as f:
    f.write(viz["image_data"])

print(f"Circuit stats: {viz['stats']}")
```

### client.get_recommendations()

Get ML-powered recommendations for execution parameters.

```python
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
```

### client.get_digital_twin()

Generate AI-powered insights about circuit execution.

```python
insights = client.get_digital_twin(
    algorithm="vqe",
    circuit_info={"qubits": 4, "gates": 20, "depth": 10},
    execution_results={"probabilities": result.probabilities, "counts": result.counts},
    backend_config={"shots": 2048, "errorMitigation": "medium"}
)

print(f"Interpretation: {insights['algorithm_interpretation']}")
print(f"Key findings: {insights['key_findings']}")
print(f"Recommendations: {insights['recommendations']}")
```

### client.ping()

Test API connectivity.

```python
if client.ping():
    print("Connected to Planck API!")
else:
    print("Connection failed")
```

## Error Handling

```python
from planck_sdk import PlanckClient, AuthenticationError, CircuitError, APIError

try:
    client = PlanckClient(api_key="your_api_key")
    result = client.run(data=[1, 2, 3])
except AuthenticationError as e:
    print(f"Auth failed: {e}")
except CircuitError as e:
    print(f"Circuit error: {e}")
except APIError as e:
    print(f"API error: {e}")
```

## Environment Variables

You can also set your API key via environment variable:

```bash
export PLANCK_API_KEY="sk_live_your_api_key"
```

```python
import os
from planck_sdk import PlanckClient

client = PlanckClient(api_key=os.environ["PLANCK_API_KEY"])
```

## Security

The SDK implements several security measures:

- **Input validation**: All inputs are validated before sending
- **API key validation**: API keys are checked for proper format
- **Rate limiting**: Automatic 3-second wait between requests
- **Payload size limits**: Requests are limited to 1MB
- **Sanitization**: Strings are sanitized to prevent injection attacks

## Support

- Platform: https://plancktechnologies.xyz
- GitHub: https://github.com/HectorNaaa/Planck-QSaaS
- Email: hello@plancktechnologies.xyz
