"""
Planck SDK - Python client for Planck Quantum Digital Twins Platform
=====================================================================

A lightweight Python SDK to interact with the Planck quantum computing platform,
enabling circuit generation, simulation, and result management.

Installation:
    pip install planck_sdk

Quick Start:
    from planck_sdk import PlanckUser
    
    user = PlanckUser(api_key="your_api_key")
    
    # Generate and run a quantum circuit
    result = user.run(
        data=[1.0, 2.0, 3.0, 4.0],
        algorithm="vqe",
        shots=1024
    )
    
    print(result.counts)
    print(result.fidelity)

Get your API key at:
    https://plancktechnologies.xyz/qsaas/settings
"""

__version__ = "1.0.0"
__author__ = "Planck Technologies"
__github__ = "https://github.com/HectorNaaa/Planck-QSaaS"

from .client import PlanckUser
from .circuit import QuantumCircuit
from .result import ExecutionResult
from .exceptions import PlanckError, AuthenticationError, CircuitError, APIError, ValidationError

# Backwards compatibility alias
PlanckClient = PlanckUser

__all__ = [
    "PlanckUser",
    "PlanckClient",  # Keep for backwards compatibility
    "QuantumCircuit", 
    "ExecutionResult",
    "PlanckError",
    "AuthenticationError",
    "CircuitError",
    "APIError",
    "ValidationError",
    "__version__",
    "__github__",
]


def get_install_command() -> str:
    """Return the pip install command for this SDK."""
    return "pip install planck_sdk"


def get_notebook_install_code() -> str:
    """Return code to install SDK in Jupyter/Colab notebooks."""
    return """# Install Planck SDK (run this cell once)
!pip install -q planck_sdk
print("Planck SDK installed!")"""
