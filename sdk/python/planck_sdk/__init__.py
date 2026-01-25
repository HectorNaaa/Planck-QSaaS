"""
Planck SDK - Python client for Planck Quantum Digital Twins Platform
=====================================================================

A lightweight Python SDK to interact with the Planck quantum computing platform,
enabling circuit generation, simulation, and result management.

Installation Methods:
    # Method 1: pip install from GitHub (no git required)
    pip install https://github.com/HectorNaaa/Planck-QSaaS/archive/refs/heads/main.zip#subdirectory=sdk/python
    
    # Method 2: One-line remote install (Jupyter/Colab friendly)
    import urllib.request; exec(urllib.request.urlopen('https://raw.githubusercontent.com/HectorNaaa/Planck-QSaaS/main/sdk/python/install.py').read())
    
    # Method 3: Shell one-liner
    curl -sSL https://raw.githubusercontent.com/HectorNaaa/Planck-QSaaS/main/sdk/python/install.py | python3

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

Get your API key at:
    https://planck.plancktechnologies.xyz/qsaas/settings
"""

__version__ = "0.9.1"
__author__ = "Planck Technologies"
__github__ = "https://github.com/HectorNaaa/Planck-QSaaS"

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
    "__github__",
]


def get_install_command() -> str:
    """Return the pip install command for this SDK."""
    return "pip install https://github.com/HectorNaaa/Planck-QSaaS/archive/refs/heads/main.zip#subdirectory=sdk/python"


def get_notebook_install_code() -> str:
    """Return code to install SDK in Jupyter/Colab notebooks."""
    return """# Install Planck SDK (run this cell once)
import subprocess
import sys
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", 
    "https://github.com/HectorNaaa/Planck-QSaaS/archive/refs/heads/main.zip#subdirectory=sdk/python"])
print("Planck SDK installed! Restart runtime if needed.")"""
