#!/usr/bin/env python3
"""
Planck SDK - Remote Quick Start Example
========================================

This script can be run from ANY Python environment.
Just copy and paste this into your Python environment!

Installation:
    pip install planck_sdk

Get your API key at: https://plancktechnologies.xyz/qsaas/settings
"""

# ============================================================================
# STEP 1: Install (uncomment if running in a fresh environment)
# ============================================================================
# import subprocess, sys
# subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "planck_sdk"])

# ============================================================================
# STEP 2: Import the SDK
# ============================================================================
from planck_sdk import PlanckUser, QuantumCircuit, ExecutionResult
from planck_sdk import AuthenticationError, CircuitError, APIError

# ============================================================================
# STEP 3: Configure your API key
# ============================================================================
# Get your API key from: https://plancktechnologies.xyz/qsaas/settings

API_KEY = "YOUR_API_KEY_HERE"  # <-- Replace with your actual API key

# Or use environment variable:
# import os
# API_KEY = os.environ.get("PLANCK_API_KEY", "YOUR_API_KEY_HERE")

# ============================================================================
# STEP 4: Initialize the user
# ============================================================================
user = PlanckUser(
    api_key=API_KEY,
    base_url="https://plancktechnologies.xyz"
)

print("Planck SDK v1.0.0 - Remote Connection Ready")
print("=" * 50)

# ============================================================================
# STEP 5: Run quantum algorithms
# ============================================================================

def example_health_check():
    """Check API health and connectivity"""
    print("\n[0] Checking API Health...")
    
    health = user.health_check()
    print(f"    Status: {health.get('status', 'unknown')}")
    print(f"    Version: {health.get('version', 'unknown')}")
    
    return health


def example_vqe():
    """Run VQE (Variational Quantum Eigensolver)"""
    print("\n[1] Running VQE Algorithm...")
    
    result = user.run(
        data=[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
        algorithm="vqe",
        shots=1024,
        error_mitigation="medium"
    )
    
    print(f"    Runtime: {result.execution_time_ms:.1f}ms")
    print(f"    Fidelity: {result.fidelity:.3f}")
    print(f"    Top 3 states: {dict(list(sorted(result.counts.items(), key=lambda x: -x[1])[:3]))}")
    
    return result


def example_grover():
    """Run Grover's Search Algorithm"""
    print("\n[2] Running Grover's Search...")
    
    result = user.run(
        data=[0, 1, 1, 0],  # Pattern to search
        algorithm="grover",
        shots=2048
    )
    
    print(f"    Runtime: {result.execution_time_ms:.1f}ms")
    print(f"    Fidelity: {result.fidelity:.3f}")
    
    return result


def example_generate_circuit():
    """Generate a circuit without executing"""
    print("\n[3] Generating Bell State Circuit...")
    
    circuit = user.generate_circuit(
        algorithm="bell_state",
        num_qubits=4
    )
    
    print(f"    Qubits: {circuit.num_qubits}")
    print(f"    Depth: {circuit.depth}")
    print(f"    Gates: {circuit.gate_count}")
    print(f"    QASM preview: {circuit.qasm[:100]}...")
    
    return circuit


def example_simulate():
    """Simulate a QASM circuit directly"""
    print("\n[4] Simulating Custom QASM Circuit...")
    
    qasm = """
OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
cx q[0], q[1];
measure q -> c;
"""
    
    result = user.simulate(
        qasm=qasm,
        shots=1024,
        noise_model="ideal"
    )
    
    print(f"    Runtime: {result.execution_time_ms:.1f}ms")
    print(f"    Counts: {result.counts}")
    
    return result


def example_ml_recommendations():
    """Get ML-powered recommendations"""
    print("\n[5] Getting ML Recommendations...")
    
    recommendations = user.get_ml_recommendations(
        circuit_depth=12,
        num_qubits=6,
        gate_types=["h", "cx", "rz"]
    )
    
    print(f"    Recommended backend: {recommendations.get('recommended_backend', 'N/A')}")
    print(f"    Confidence: {recommendations.get('confidence', 0):.1%}")
    
    return recommendations


def example_digital_twin():
    """Create a digital twin analysis"""
    print("\n[6] Creating Digital Twin Analysis...")
    
    qasm = """
OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
cx q[0], q[1];
measure q -> c;
"""
    
    twin = user.create_digital_twin(
        qasm=qasm,
        hardware_profile={
            "backend": "ibm_simulator",
            "t1": 50e-6,
            "t2": 70e-6,
            "gate_error": 0.001
        }
    )
    
    print(f"    Ideal fidelity: {twin.get('ideal_fidelity', 'N/A')}")
    print(f"    Noisy fidelity: {twin.get('noisy_fidelity', 'N/A')}")
    
    return twin


def example_ai_assistant():
    """Ask the AI assistant"""
    print("\n[7] Asking AI Assistant...")
    
    answer = user.ask("What algorithm should I use for optimization problems?")
    print(f"    Answer: {answer[:200]}...")
    
    return answer


# ============================================================================
# MAIN EXECUTION
# ============================================================================
if __name__ == "__main__":
    try:
        # Run all examples
        example_health_check()
        example_vqe()
        example_grover()
        example_generate_circuit()
        example_simulate()
        example_ml_recommendations()
        example_digital_twin()
        example_ai_assistant()
        
        print("\n" + "=" * 50)
        print("All examples completed successfully!")
        print("=" * 50)
        
    except AuthenticationError as e:
        print(f"\nAuthentication Error: {e}")
        print("Make sure to replace YOUR_API_KEY_HERE with your actual API key.")
        print("Get your key at: https://plancktechnologies.xyz/qsaas/settings")
        
    except CircuitError as e:
        print(f"\nCircuit Error: {e}")
        
    except APIError as e:
        print(f"\nAPI Error: {e}")
        
    except Exception as e:
        print(f"\nUnexpected Error: {e}")
