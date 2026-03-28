"""
Planck SDK — canonical examples
================================
Works in standard Python, Jupyter / Google Colab, or any IDE.

Installation (run once):
    pip install planck_sdk

Get your API key at:
    https://plancktechnologies.xyz/qsaas/settings
"""

# ── Install hint (uncomment in Colab / Jupyter) ───────────────────────────────
# import subprocess, sys
# subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "planck_sdk"])

import os
from planck_sdk import PlanckUser, QuantumCircuit, ExecutionResult
from planck_sdk import AuthenticationError, CircuitError, APIError, ValidationError

# ── Configure ─────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("PLANCK_API_KEY", "YOUR_API_KEY_HERE")

user = PlanckUser(api_key=API_KEY)

# ── 0. Health check ───────────────────────────────────────────────────────────
def example_health():
    """Verify API connectivity before running circuits."""
    health = user.health_check()
    print(f"[health] status={health.get('status')}  version={health.get('version')}")


# ── 0b. List digital twins ────────────────────────────────────────────────────
def example_list_twins():
    """Print all digital twins available in this account.

    Use the 'id' from here as digital_twin_id in run().
    Pass digital_twin_id=None (or 0 / '') to leave a run unlinked.
    """
    twins = user.list_digital_twins()
    if not twins:
        print("[digital twins] none found — create one in the QSaaS Runner UI.")
        return
    for t in twins:
        print(f"  {t['id']}  {t['name']:30s}  created: {t['created_at'][:10]}")
    return twins


# ── 1. Bell state ─────────────────────────────────────────────────────────────
def example_bell():
    """Simplest entangled circuit — should produce ~50% |00⟩, 50% |11⟩."""
    result = user.run(data=[1, 0], algorithm="bell", shots=2048)
    print(f"[bell]  runtime={result.runtime_ms:.1f}ms  fidelity={result.fidelity:.3f}")
    top = dict(sorted(result.counts.items(), key=lambda x: -x[1])[:3])
    print(f"        top-3 states: {top}")
    return result


# ── 2. VQE ────────────────────────────────────────────────────────────────────
def example_vqe():
    """Variational Quantum Eigensolver — ground-state energy estimation."""
    result = user.run(
        data=[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
        algorithm="vqe",
        shots=1024,
        error_mitigation="auto",   # RL-driven, adjusts with circuit complexity
    )
    result.plot_histogram(top_n=5)
    return result


# ── 3. Grover search ──────────────────────────────────────────────────────────
def example_grover():
    """Grover's algorithm — O(√N) unstructured search."""
    result = user.run(
        data=[0, 1, 1, 0],
        algorithm="grover",
        shots=2048,
    )
    most_frequent = max(result.counts.items(), key=lambda x: x[1])
    print(f"[grover] found |{most_frequent[0]}⟩  ({most_frequent[1]} hits)")
    return result


# ── 4. Custom QASM simulation ─────────────────────────────────────────────────
def example_custom_qasm():
    """Simulate a hand-written QASM 2.0 circuit directly."""
    qasm = """\
OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
creg c[3];
h q[0]; h q[1]; h q[2];
cx q[0], q[1];
cx q[1], q[2];
measure q -> c;"""

    result = user.simulate(qasm=qasm, shots=1024, backend="auto")
    print(f"[qasm]  counts={result.counts}  runtime={result.runtime_ms:.1f}ms")
    return result


# ── 5. ML recommendations ─────────────────────────────────────────────────────
def example_ml_recs():
    """Query the RL engine for circuit-specific backend + shot recommendations."""
    recs = user.get_recommendations(
        qubits=6, depth=12, gate_count=30, algorithm="qaoa", data_size=100,
    )
    print(
        f"[ml]  backend={recs.get('recommended_backend')}  "
        f"shots={recs.get('recommended_shots')}  "
        f"mitigation={recs.get('recommended_error_mitigation')}  "
        f"confidence={recs.get('confidence', 0):.0%}"
    )
    return recs


# ── 6. Digital twin analysis ──────────────────────────────────────────────────
def example_digital_twin():
    """Run a circuit and feed its results into the digital twin interpreter."""
    result = user.run(data=[1, 0, 1, 0], algorithm="bell", shots=1024)

    twin = user.get_digital_twin(
        algorithm="bell",
        circuit_info={
            "qubits": result.circuit.qubits if result.circuit else 2,
            "gates":  result.circuit.gate_count if result.circuit else 4,
            "depth":  result.circuit.depth if result.circuit else 3,
        },
        execution_results={
            "probabilities": result.probabilities,
            "counts":        result.counts,
            "execution_id":  result.execution_id,
        },
        backend_config={"shots": result.shots, "errorMitigation": "medium"},
    )
    print(f"[twin]  {twin.get('algorithm_interpretation', 'N/A')}")
    for finding in twin.get("key_findings", [])[:3]:
        print(f"  • {finding}")
    return twin


# ── 7. Transpile + visualize ──────────────────────────────────────────────────
def example_transpile_and_visualize():
    """Generate a circuit, transpile it for QPU, then render an SVG."""
    circuit = user.generate_circuit(data=[1, 0], algorithm="bell", qubits=2)

    # Transpile for quantum hardware
    transpiled = user.transpile(qasm=circuit.qasm, backend="quantum_qpu", qubits=2)
    print(
        f"[transpile]  swaps={transpiled['swap_count']}  "
        f"depth={transpiled['depth']}  mapping={transpiled['mapped_qubits']}"
    )

    # Render circuit as SVG
    viz = user.visualize(qasm=circuit.qasm)
    with open("circuit.svg", "w") as f:
        f.write(viz["image_data"])
    print(f"[viz]  saved circuit.svg  ({viz['width']}x{viz['height']}px)")


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        example_health()
        example_bell()
        example_vqe()
        example_grover()
        example_custom_qasm()
        example_ml_recs()
        example_digital_twin()
        example_transpile_and_visualize()
        print("\nAll examples completed.")

    except AuthenticationError:
        print("Auth error — set PLANCK_API_KEY or replace YOUR_API_KEY_HERE above.")
        print("Keys: https://plancktechnologies.xyz/qsaas/settings")
    except (CircuitError, APIError, ValidationError) as e:
        print(f"Error: {e}")
