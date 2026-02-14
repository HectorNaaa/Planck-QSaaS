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
from planck_sdk import AuthenticationError, CircuitError, APIError, ValidationError

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
        error_mitigation="medium",
    )

    print(f"    Runtime: {result.runtime_ms:.1f}ms")
    print(f"    Fidelity: {result.fidelity:.3f}")
    top3 = dict(list(sorted(result.counts.items(), key=lambda x: -x[1])[:3]))
    print(f"    Top 3 states: {top3}")

    return result


def example_grover():
    """Run Grover's Search Algorithm"""
    print("\n[2] Running Grover's Search...")

    result = user.run(
        data=[0, 1, 1, 0],  # Pattern to search
        algorithm="grover",
        shots=2048,
    )

    print(f"    Runtime: {result.runtime_ms:.1f}ms")
    print(f"    Fidelity: {result.fidelity:.3f}")

    return result


def example_generate_circuit():
    """Generate a circuit without executing"""
    print("\n[3] Generating Bell State Circuit...")

    circuit = user.generate_circuit(
        data=[1, 0],
        algorithm="bell",
        qubits=2,
    )

    print(f"    Qubits: {circuit.qubits}")
    print(f"    Depth: {circuit.depth}")
    print(f"    Gates: {circuit.gate_count}")
    print(f"    QASM preview: {circuit.qasm[:100]}...")

    return circuit


def example_simulate():
    """Simulate a QASM circuit directly"""
    print("\n[4] Simulating Custom QASM Circuit...")

    qasm = """OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
creg c[2];
h q[0];
cx q[0], q[1];
measure q -> c;"""

    result = user.simulate(
        qasm=qasm,
        shots=1024,
        backend="auto",
        error_mitigation="medium",
    )

    print(f"    Runtime: {result.runtime_ms:.1f}ms")
    print(f"    Counts: {result.counts}")

    return result


def example_ml_recommendations():
    """Get ML-powered recommendations"""
    print("\n[5] Getting ML Recommendations...")

    recommendations = user.get_recommendations(
        qubits=6,
        depth=12,
        gate_count=30,
        algorithm="qaoa",
        data_size=100,
    )

    print(f"    Recommended backend: {recommendations.get('recommended_backend', 'N/A')}")
    print(f"    Recommended shots: {recommendations.get('recommended_shots', 'N/A')}")
    print(f"    Confidence: {recommendations.get('confidence', 0):.1%}")

    return recommendations


def example_digital_twin():
    """Create a digital twin analysis"""
    print("\n[6] Creating Digital Twin Analysis...")

    # First run a circuit to get execution results
    result = user.run(
        data=[1, 0, 1, 0],
        algorithm="bell",
        shots=1024,
    )

    # Then request a digital twin analysis
    twin = user.get_digital_twin(
        algorithm="bell",
        circuit_info={
            "qubits": result.circuit.qubits if result.circuit else 2,
            "gates": result.circuit.gate_count if result.circuit else 4,
            "depth": result.circuit.depth if result.circuit else 3,
        },
        execution_results={
            "probabilities": result.probabilities,
            "counts": result.counts,
            "execution_id": result.execution_id,
        },
        backend_config={
            "shots": result.shots,
            "errorMitigation": "medium",
        },
    )

    print(f"    Interpretation: {twin.get('algorithm_interpretation', 'N/A')}")

    return twin


def example_transpile():
    """Transpile a circuit for quantum hardware"""
    print("\n[7] Transpiling Circuit for Quantum QPU...")

    circuit = user.generate_circuit(
        data=[1, 0],
        algorithm="bell",
        qubits=2,
    )

    transpiled = user.transpile(
        qasm=circuit.qasm,
        backend="quantum_qpu",
        qubits=2,
    )

    print(f"    Swap count: {transpiled['swap_count']}")
    print(f"    New depth: {transpiled['depth']}")
    print(f"    Mapped qubits: {transpiled['mapped_qubits']}")

    return transpiled


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
        example_transpile()

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
