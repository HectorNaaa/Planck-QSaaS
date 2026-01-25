#!/usr/bin/env python3
"""
Planck SDK - Remote Quick Start Example

This script can be run from ANY Python environment without cloning the repository.
Just copy and paste this into your Python environment!

Installation (run this first):
    pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python

Or in a Jupyter/Colab cell:
    !pip install git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python
"""

# ============================================================================
# STEP 1: Install (uncomment if running in a fresh environment)
# ============================================================================
# import subprocess
# subprocess.check_call([
#     "pip", "install", 
#     "git+https://github.com/HectorNaaa/Planck-QSaaS.git#subdirectory=sdk/python"
# ])

# ============================================================================
# STEP 2: Import the SDK
# ============================================================================
from planck_sdk import PlanckClient, QuantumCircuit, ExecutionResult
from planck_sdk import AuthenticationError, CircuitError, APIError

# ============================================================================
# STEP 3: Configure your API key
# ============================================================================
# Get your API key from: https://planck.plancktechnologies.xyz/qsaas/settings

API_KEY = "YOUR_API_KEY_HERE"  # <-- Replace with your actual API key

# Or use environment variable:
# import os
# API_KEY = os.environ.get("PLANCK_API_KEY", "YOUR_API_KEY_HERE")

# ============================================================================
# STEP 4: Initialize the client
# ============================================================================
client = PlanckClient(
    api_key=API_KEY,
    base_url="https://planck.plancktechnologies.xyz"
)

print("Planck SDK v0.9.0 - Remote Connection Ready")
print("=" * 50)

# ============================================================================
# STEP 5: Run quantum algorithms
# ============================================================================

def example_vqe():
    """Run VQE (Variational Quantum Eigensolver)"""
    print("\n[1] Running VQE Algorithm...")
    
    result = client.run(
        data=[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
        algorithm="vqe",
        shots=1024,
        error_mitigation="medium"
    )
    
    print(f"    Runtime: {result.runtime_ms:.1f}ms")
    print(f"    Fidelity: {result.fidelity:.3f}")
    print(f"    Top 3 states: {dict(list(sorted(result.counts.items(), key=lambda x: -x[1])[:3]))}")
    
    return result


def example_grover():
    """Run Grover's Search Algorithm"""
    print("\n[2] Running Grover's Search...")
    
    result = client.run(
        data=[0, 1, 1, 0],  # Pattern to search
        algorithm="grover",
        shots=2048
    )
    
    print(f"    Runtime: {result.runtime_ms:.1f}ms")
    print(f"    Fidelity: {result.fidelity:.3f}")
    
    return result


def example_generate_circuit():
    """Generate a circuit without executing"""
    print("\n[3] Generating Bell State Circuit...")
    
    circuit = client.generate_circuit(
        data=[1, 0, 1, 0],
        algorithm="bell",
        qubits=4
    )
    
    print(f"    Qubits: {circuit.qubits}")
    print(f"    Depth: {circuit.depth}")
    print(f"    Gates: {circuit.gate_count}")
    print(f"    QASM preview: {circuit.qasm[:100]}...")
    
    return circuit


def example_ml_recommendations():
    """Get ML-powered recommendations"""
    print("\n[4] Getting ML Recommendations...")
    
    recommendations = client.get_recommendations(
        qubits=6,
        depth=12,
        gate_count=30,
        algorithm="qaoa",
        data_size=50
    )
    
    print(f"    Recommended shots: {recommendations['recommended_shots']}")
    print(f"    Recommended backend: {recommendations['recommended_backend']}")
    print(f"    Confidence: {recommendations['confidence']:.1%}")
    
    return recommendations


def example_ai_assistant():
    """Ask the AI assistant"""
    print("\n[5] Asking AI Assistant...")
    
    answer = client.ask("What algorithm should I use for optimization problems?")
    print(f"    Answer: {answer[:200]}...")
    
    return answer


# ============================================================================
# MAIN EXECUTION
# ============================================================================
if __name__ == "__main__":
    try:
        # Run all examples
        example_vqe()
        example_grover()
        example_generate_circuit()
        example_ml_recommendations()
        example_ai_assistant()
        
        print("\n" + "=" * 50)
        print("All examples completed successfully!")
        print("=" * 50)
        
    except AuthenticationError as e:
        print(f"\nAuthentication Error: {e}")
        print("Make sure to replace YOUR_API_KEY_HERE with your actual API key.")
        print("Get your key at: https://planck.plancktechnologies.xyz/qsaas/settings")
        
    except CircuitError as e:
        print(f"\nCircuit Error: {e}")
        
    except APIError as e:
        print(f"\nAPI Error: {e}")
        
    except Exception as e:
        print(f"\nUnexpected Error: {e}")
