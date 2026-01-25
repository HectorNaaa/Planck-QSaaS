# Planck Quantum API Documentation

Official API documentation for the Planck Quantum Digital Twins Platform.

## Quick Start (Google Colab / Jupyter / Any Python)

**No need to clone the repository!** Install and use directly:

```python
# Install SDK directly from GitHub
!pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python

# Import and use
from planck_sdk import PlanckClient

client = PlanckClient(
    api_key="YOUR_API_KEY",  # Get from Settings > API Keys
    base_url="https://planck.plancktechnologies.xyz"
)

# Run a quantum algorithm
result = client.run(
    data=[1.0, 2.0, 3.0, 4.0],
    algorithm="vqe",
    shots=1024
)

print(result.counts)
print(f"Fidelity: {result.fidelity}")
```

Get your API key at: https://planck.plancktechnologies.xyz/qsaas/settings

## Base URL

```
https://planck.plancktechnologies.xyz
```

## Authentication

All API requests require authentication using an API key. You can generate an API key from your [Settings page](https://planck.plancktechnologies.xyz/qsaas/settings).

### API Key Header

```http
X-API-Key: your_api_key_here
```

## Rate Limiting

- **Rate Limit**: 1 request per 3 seconds per user
- **Payload Limit**: 1 MB maximum request size

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

## Endpoints

### 1. Generate Quantum Circuit

Generate a quantum circuit based on algorithm type and parameters.

**Endpoint**: `POST /api/quantum/generate-circuit`

**Request Body**:
```json
{
  "algorithm": "Bell",
  "inputData": { "target": "01" },
  "qubits": 2,
  "shots": 1024,
  "errorMitigation": "basic"
}
```

**Response**:
```json
{
  "success": true,
  "qasm": "OPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0],q[1];\nmeasure q -> c;",
  "qubits": 2,
  "depth": 3,
  "gateCount": 2,
  "gates": [...],
  "recommendedShots": 1024,
  "metadata": {...}
}
```

### 2. Simulate Quantum Circuit

Execute a quantum circuit simulation.

**Endpoint**: `POST /api/quantum/simulate`

**Request Body**:
```json
{
  "qasm": "OPENQASM 2.0;...",
  "shots": 1024,
  "backend": "quantum_inspired_gpu",
  "errorMitigation": "basic",
  "circuitName": "Bell State",
  "algorithm": "Bell",
  "executionType": "simulation",
  "qubits": 2
}
```

**Response**:
```json
{
  "success": true,
  "counts": { "00": 512, "11": 512 },
  "probabilities": { "00": 0.5, "11": 0.5 },
  "executionTime": 145,
  "backend": "quantum_inspired_gpu",
  "shots": 1024,
  "fidelity": 0.98
}
```

### 3. Transpile Circuit

Transpile a circuit for a specific backend topology.

**Endpoint**: `POST /api/quantum/transpile`

**Request Body**:
```json
{
  "qasm": "OPENQASM 2.0;...",
  "backend": "quantum_qpu",
  "qubits": 5
}
```

**Response**:
```json
{
  "success": true,
  "transpiledQASM": "...",
  "swapCount": 2,
  "mappedQubits": [0, 1, 2, 3, 4],
  "depth": 8
}
```

### 4. ML Recommendation

Get ML-powered recommendations for execution parameters.

**Endpoint**: `POST /api/quantum/ml-recommend`

**Request Body**:
```json
{
  "qubits": 3,
  "depth": 5,
  "gateCount": 8,
  "algorithm": "Grover",
  "dataSize": 100,
  "dataComplexity": "medium",
  "targetLatency": 1000,
  "errorMitigation": "basic"
}
```

**Response**:
```json
{
  "success": true,
  "recommendedShots": 2048,
  "recommendedBackend": "quantum_inspired_gpu",
  "recommendedErrorMitigation": "advanced",
  "confidence": 0.85,
  "reasoning": "Based on circuit complexity and historical performance",
  "basedOnExecutions": 150
}
```

### 5. Generate Digital Twin

Generate AI-powered insights about circuit execution.

**Endpoint**: `POST /api/quantum/digital-twin`

**Request Body**:
```json
{
  "algorithm": "Bell",
  "inputData": {...},
  "circuitInfo": {
    "qubits": 2,
    "gates": 2,
    "depth": 3
  },
  "executionResults": {
    "probabilities": { "00": 0.5, "11": 0.5 },
    "counts": { "00": 512, "11": 512 },
    "execution_id": "uuid"
  },
  "backendConfig": {
    "shots": 1024,
    "errorMitigation": "basic"
  }
}
```

**Response**:
```json
{
  "success": true,
  "digital_twin": {
    "algorithm_interpretation": "...",
    "key_findings": [...],
    "data_insights": [...],
    "statistical_analysis": {...},
    "recommendations": [...],
    "timestamp": "2026-01-25T..."
  }
}
```

### 6. Visualize Circuit

Generate SVG visualization of a quantum circuit.

**Endpoint**: `POST /api/quantum/visualize`

**Request Body**:
```json
{
  "qasm": "OPENQASM 2.0;..."
}
```

**Response**:
```json
{
  "success": true,
  "image_data": "<svg>...</svg>",
  "format": "svg",
  "stats": {
    "gates": 2,
    "qubits": 2,
    "depth": 3
  },
  "width": 800,
  "height": 200
}
```

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes**:
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid or missing API key)
- `413` - Payload Too Large (exceeds 1 MB)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Python SDK

For easier integration, use our official Python SDK.

### Installation (Remote - No Cloning Required)

```bash
# Install directly from GitHub (works in Colab, Jupyter, any Python)
pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
```

### Full Example

```python
from planck_sdk import PlanckClient

client = PlanckClient(
    api_key="your_api_key",
    base_url="https://planck.plancktechnologies.xyz"
)

# Run any algorithm with your data
result = client.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",      # vqe, grover, qaoa, qft, bell
    shots=1024,
    error_mitigation="medium"
)

print(result.counts)
print(f"Fidelity: {result.fidelity}")
print(f"Runtime: {result.runtime_ms}ms")

# Generate circuit without executing
circuit = client.generate_circuit(
    data=[1, 2, 3, 4],
    algorithm="grover"
)
print(circuit.qasm)

# Get ML recommendations
recommendations = client.get_recommendations(
    qubits=4,
    depth=10,
    gate_count=20,
    algorithm="qaoa",
    data_size=100
)
print(f"Recommended shots: {recommendations['recommended_shots']}")

# Ask the AI assistant
answer = client.ask("When should I use VQE vs QAOA?")
print(answer)
```

See the [SDK documentation](./sdk/python/README.md) for complete examples and the [Colab notebook](./sdk/python/examples/planck_colab_quickstart.ipynb) for interactive tutorials.

## Support

- **Email**: hello@plancktechnologies.xyz
- **GitHub**: https://github.com/HectorNaaa/Planck-QSaaS
- **Docs**: https://planck.plancktechnologies.xyz

## Version

Current API version: **v0.9 (Beta)**
