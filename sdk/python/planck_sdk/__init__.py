"""
Planck SDK - Python client for Planck Quantum Digital Twins Platform
=====================================================================

A Python SDK to interact with the Planck quantum computing platform,
enabling circuit generation, simulation, and result management.

Installation:
    pip install planck-sdk

Quick Start:
    from planck_sdk import PlanckClient
    
    client = PlanckClient(api_key="your_api_key")
    
    # Generate and run a quantum circuit
    result = client.run(
        data=[1.0, 2.0, 3.0, 4.0],
        algorithm="vqe",
        shots=1024
    )
    
    print(result.counts)
    print(result.fidelity)
"""

__version__ = "0.9.0"
__author__ = "Planck Technologies"

from .client import PlanckClient
from .circuit import QuantumCircuit
from .result import ExecutionResult
from .exceptions import PlanckError, AuthenticationError, CircuitError, APIError

__all__ = [
    "PlanckClient",
    "QuantumCircuit", 
    "ExecutionResult",
    "PlanckError",
    "AuthenticationError",
    "CircuitError",
    "APIError",
    "__version__",
]
