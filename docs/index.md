# Welcome to Planck SDK

The **Planck Python SDK** allows you to seamlessly integrate your Python applications with the Planck Quantum Software-as-a-Service (QSaaS) platform. With it, you can design, compile, transpile, simulate, and execute quantum circuits on world-class HPC simulation backends and Quantum Processing Units (QPUs).

## Installation

The SDK requires Python 3.9+.

```bash
pip install planck-sdk
```

## Quick Start

```python
from planck_sdk.client import PlanckUser

# Initialize the client
client = PlanckUser(api_key="sk_your_api_key_here")

# Run a VQE job with input data
result = client.run(
    data=[0.1, 0.2, 0.5, 0.9],
    algorithm="vqe",
    backend="hpc_gpu"
)

print(result.overview)
result.plot_histogram()
```

## Features

- **End-to-End Execution**: Generate and simulate circuits with one call using `client.run()`.
- **Digital Twins**: Seamless integration with ML-based error mitigation and recommendations.
- **Detailed Results**: Rich result objects `ExecutionResult` and easy data visualization.

Check out the [Client API Reference](api/client.md) to get started!
