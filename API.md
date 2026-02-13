# Planck Quantum API Documentation

Official API documentation for the Planck Quantum Digital Twins Platform.

## Quick Start (Python SDK v0.9)

```bash
pip install planck_sdk
```

```python
from planck_sdk import PlanckUser

# Initialize user (new in v0.9)
user = PlanckUser(
    api_key="YOUR_API_KEY",  # Get from Settings > API Keys
    base_url="https://plancktechnologies.xyz"
)

# Run a quantum algorithm
result = user.run(
    data=[1.0, 2.0, 3.0, 4.0],
    algorithm="vqe",
    shots=1024
)

print(result.counts)
print(f"Success Rate: {result.success_rate}%")
```

**Note:** `PlanckClient` is still supported for backwards compatibility, but `PlanckUser` is recommended.

Get your API key at: https://plancktechnologies.xyz/qsaas/settings

## Base URL

```
https://plancktechnologies.xyz
```

## Authentication

All API requests require authentication using an API key. You can generate an API key from your [Settings page](https://plancktechnologies.xyz/qsaas/settings).

### API Key Format (v0.9)

- **Format**: Pure alphanumeric hexadecimal string (64 characters)
- **Example**: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`
- **Note**: Old format with `plk_` prefix is no longer supported. Please regenerate your API key if you have an old one.

### API Key Header

```http
X-API-Key: your_api_key_here
```

## Rate Limiting

- **Rate Limit**: 1 request per 3 seconds per user
- **Payload Limit**: 1 MB maximum request size

When rate limited, you'll receive a `429 Too Many Requests` response with a `Retry-After` header.

## Security

All API endpoints implement comprehensive security measures:

- **Input validation**: All parameters are validated and sanitized
- **SQL injection protection**: All database queries use parameterized statements
- **XSS protection**: String inputs are HTML-escaped
- **Rate limiting**: Prevents API abuse
- **Payload size limits**: Prevents DoS attacks
- **API key validation**: Validates format before authentication

## Endpoints

### 1. Health Check

Check API status and verify authentication.

**Endpoint**: `GET /api/quantum/health`

**Response**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-01-26T...",
  "version": "1.0.0"
}
```

### 2. Generate Quantum Circuit

Generate a quantum circuit based on algorithm type and parameters.

**Endpoint**: `POST /api/quantum/generate-circuit`

**Request Body**:
```json
{
  "algorithm": "Bell",
  "inputData": [1, 2, 3, 4],
  "qubits": 2
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

### 3. Simulate Quantum Circuit

Execute a quantum circuit simulation.

**Endpoint**: `POST /api/quantum/simulate`

**Request Body**:
```json
{
  "qasm": "OPENQASM 2.0;...",
  "shots": 1024,
  "backend": "quantum_inspired_gpu",
  "errorMitigation": "medium",
  "circuitName": "Bell State",
  "algorithm": "Bell",
  "executionType": "simulation",
  "qubits": 2,
  "inputData": [1, 2],
  "depth": 3,
  "gateCount": 2
}
```

**Response**:
```json
{
  "success": true,
  "counts": { "00": 512, "11": 512 },
  "successRate": 50.0,
  "runtime": 145,
  "memory": ["00", "11"],
  "execution_id": "uuid",
  "fidelity": 0.98
}
```

### 4. Transpile Circuit

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

### 5. ML Recommendation

Get ML-powered recommendations for execution parameters.

**Endpoint**: `POST /api/quantum/ml-recommend`

**Request Body**:
```json
{
  "qubits": 3,
  "depth": 5,
  "gateCount": 8,
  "algorithm": "Grover",
  "dataSize": 100
}
```

**Response**:
```json
{
  "success": true,
  "recommendedShots": 2048,
  "recommendedBackend": "quantum_inspired_gpu",
  "recommendedErrorMitigation": "medium",
  "confidence": 0.85,
  "reasoning": "Based on circuit complexity and historical performance",
  "basedOnExecutions": 150
}
```

### 6. Generate Digital Twin

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
    "errorMitigation": "medium"
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
    "timestamp": "2026-01-26T..."
  }
}
```

### 7. Visualize Circuit

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

### 8. AI Assistant

Ask questions about quantum computing.

**Endpoint**: `POST /api/quantum/assistant`

**Request Body**:
```json
{
  "messages": [
    { "role": "user", "content": "What is VQE?" }
  ],
  "includeHistory": true
}
```

**Response**: Streaming text response

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
- `403` - Forbidden (request blocked)
- `413` - Payload Too Large (exceeds 1 MB)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable

## Python SDK

For easier integration, use our official Python SDK.

### Installation

```bash
pip install planck_sdk
```

### Full Example (SDK v0.9)

```python
from planck_sdk import PlanckUser

# Initialize user (recommended naming in v0.9)
user = PlanckUser(
    api_key="your_api_key",
    base_url="https://plancktechnologies.xyz"
)

# Run any algorithm with your data
result = user.run(
    data=[1.0, 2.0, 3.0, 4.0, 5.0],
    algorithm="vqe",      # vqe, grover, qaoa, qft, bell, shor
    shots=1024,
    error_mitigation="medium"
)

print(result.counts)
print(f"Success Rate: {result.success_rate}%")
print(f"Runtime: {result.runtime_ms}ms")

# Generate circuit without executing
circuit = user.generate_circuit(
    data=[1, 2, 3, 4],
    algorithm="grover"
)
print(circuit.qasm)

# Get ML recommendations
recommendations = user.get_recommendations(
    qubits=4,
    depth=10,
    gate_count=20,
    algorithm="qaoa",
    data_size=100
)
print(f"Recommended shots: {recommendations['recommended_shots']}")

# Transpile for specific backend
transpiled = user.transpile(
    qasm=circuit.qasm,
    backend="quantum_qpu"
)
print(f"Swap count: {transpiled['swap_count']}")

# Generate circuit visualization
viz = user.visualize(qasm=circuit.qasm)
with open("circuit.svg", "w") as f:
    f.write(viz["image_data"])

# Get digital twin insights
insights = user.get_digital_twin(
    algorithm="vqe",
    circuit_info={"qubits": 4, "gates": 20, "depth": 10},
    execution_results={"probabilities": result.probabilities, "counts": result.counts}
)
print(insights["algorithm_interpretation"])
```

See the [SDK documentation](./sdk/python/README.md) for complete examples.

## Support

- **Email**: hello@plancktechnologies.xyz
- **GitHub**: https://github.com/HectorNaaa/Planck-QSaaS
- **Docs**: https://plancktechnologies.xyz

## Version

Current API version: **v1.0.0**
