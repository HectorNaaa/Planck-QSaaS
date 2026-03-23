"""
quantum_circuit_generator.py
─────────────────────────────────────────────────────────────────────────────
Dynamic, data-aware OpenQASM 2.0 circuit generator.

Usage:
    python quantum_circuit_generator.py <algorithm> <data_json>

    algorithm : bell | grover | shor | vqe | qaoa | qft
    data_json : JSON string — array of rows OR {"rows":[...]} OR {"features":n}

All register sizes, gate counts, and rotation angles are derived from the
input data.  Nothing is hardcoded or random.  Output is a JSON object:

    {
        "algorithm":   str,
        "qubits":      int,
        "depth":       int,
        "gate_count":  int,
        "qasm":        str,
        "param_summary": str
    }
"""

import json
import math
import sys
from typing import Any


# ─── Data profiling ────────────────────────────────────────────────────────────

def analyze(data: Any) -> dict:
    """
    Derive a DataProfile from arbitrary JSON input.

    Returns:
        qubits      – register size, clamped [2, 20]
        depth       – circuit depth estimate
        gate_count  – total gate estimate
        angles      – list of rotation angles in [0, π] derived from feature means
        features    – number of numeric feature columns
        samples     – number of rows
        complexity  – float in [0, 1]
    """
    rows = _normalize_rows(data)
    samples = max(1, len(rows))

    # Collect numeric column values
    col_vals: dict[int, list[float]] = {}
    for row in rows:
        for i, v in enumerate(_numeric_values(row)):
            col_vals.setdefault(i, []).append(v)

    features = max(1, len(col_vals))

    # Qubit count: log2(features+1)+1, clamped [2, 20]
    qubits = min(20, max(2, math.ceil(math.log2(features + 1)) + 1))

    # Normalise each feature mean → [0, π]
    angles: list[float] = []
    for col in col_vals.values():
        mean = sum(col) / len(col)
        mx = max(abs(v) for v in col) or 1.0
        angles.append((mean / mx) * math.pi)

    if not angles:
        angles = [math.pi / 4]

    complexity = min(1.0, features / 20.0 + samples / 1000.0)
    depth = 2 + round(complexity * 18) + qubits
    gate_count = depth * qubits

    return {
        "qubits": qubits,
        "depth": depth,
        "gate_count": gate_count,
        "angles": angles,
        "features": features,
        "samples": samples,
        "complexity": complexity,
    }


# ─── QASM builders ────────────────────────────────────────────────────────────

def build_bell(p: dict) -> dict:
    n = max(2, min(p["qubits"], 6))
    lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', f"qreg q[{n}];", f"creg c[{n}];"]
    angles = p["angles"]
    for i in range(n):
        θ = f"{angles[i % len(angles)]:.6f}"
        lines.append(f"ry({θ}) q[{i}];")
    for i in range(n - 1):
        lines.append(f"cx q[{i}],q[{i+1}];")
    lines.append("h q[0];")
    for i in range(n):
        lines.append(f"measure q[{i}] -> c[{i}];")
    return {
        "qasm": "\n".join(lines),
        "qubits": n,
        "depth": 3 + math.ceil(n / 2),
        "gate_count": n + (n - 1) + 1 + n,
        "param_summary": f"{n} qubits, {p['features']} features → Ry angles from data",
    }


def build_grover(p: dict) -> dict:
    n = max(2, min(p["qubits"], 10))
    iters = max(1, round((math.pi / 4) * math.sqrt(2 ** n)))
    angles = p["angles"]
    lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', f"qreg q[{n}];", f"creg c[{n}];"]
    for i in range(n):
        lines.append(f"h q[{i}];")
    for _ in range(iters):
        for i in range(n):
            φ = f"{angles[i % len(angles)]:.6f}"
            lines.append(f"rz({φ}) q[{i}];")
        for i in range(n):
            lines.append(f"h q[{i}];")
        for i in range(n):
            lines.append(f"x q[{i}];")
        for i in range(n - 1):
            lines.append(f"cx q[{i}],q[{n-1}];")
        lines.append(f"h q[{n-1}];")
        for i in range(n - 1):
            lines.append(f"cx q[{i}],q[{n-1}];")
        lines.append(f"h q[{n-1}];")
        for i in range(n):
            lines.append(f"x q[{i}];")
        for i in range(n):
            lines.append(f"h q[{i}];")
    for i in range(n):
        lines.append(f"measure q[{i}] -> c[{i}];")
    return {
        "qasm": "\n".join(lines),
        "qubits": n,
        "depth": n + iters * (6 + 2 * n),
        "gate_count": n + iters * (n + n + (n - 1) + 1 + (n - 1) + 1 + n + n) + n,
        "param_summary": f"{n} qubits, {iters} iteration(s), Rz angles from data",
    }


def build_shor(p: dict) -> dict:
    n = max(3, min(p["qubits"], 8))
    m = max(2, n // 2)
    angles = p["angles"]
    lines = [
        "OPENQASM 2.0;", 'include "qelib1.inc";',
        f"qreg q[{n}];", f"qreg anc[{m}];", f"creg c[{n}];",
    ]
    for i in range(n):
        lines.append(f"h q[{i}];")
    for i in range(n):
        for j in range(i + 1, n):
            k = j - i + 1
            θ = f"{math.pi / (2 ** (k - 1)):.6f}"
            lines.append(f"cu1({θ}) q[{i}],q[{j}];")
    for i in range(m):
        θ = f"{angles[i % len(angles)]:.6f}"
        lines.append(f"ry({θ}) anc[{i}];")
        lines.append(f"cx anc[{i}],q[{i % n}];")
    for i in range(n - 1, -1, -1):
        for j in range(n - 1, i, -1):
            k = j - i + 1
            θ = f"{-(math.pi / (2 ** (k - 1))):.6f}"
            lines.append(f"cu1({θ}) q[{i}],q[{j}];")
        lines.append(f"h q[{i}];")
    for i in range(n):
        lines.append(f"measure q[{i}] -> c[{i}];")
    gc = n + (n * (n - 1)) // 2 + 2 * m + (n * (n - 1)) // 2 + n + n
    return {
        "qasm": "\n".join(lines),
        "qubits": n + m,
        "depth": 3 * n + m,
        "gate_count": gc,
        "param_summary": f"{n} counting + {m} ancilla qubits, angles from data",
    }


def build_vqe(p: dict) -> dict:
    n = max(2, min(p["qubits"], 12))
    layers = max(1, round(p["complexity"] * 3) + 1)
    angles = p["angles"]
    lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', f"qreg q[{n}];", f"creg c[{n}];"]
    idx = 0
    for l in range(layers):
        for i in range(n):
            θy = f"{angles[idx % len(angles)]:.6f}"; idx += 1
            θz = f"{angles[idx % len(angles)]:.6f}"; idx += 1
            lines.append(f"ry({θy}) q[{i}];")
            lines.append(f"rz({θz}) q[{i}];")
        offset = l % 2
        for i in range(offset, n - 1, 2):
            lines.append(f"cx q[{i}],q[{i+1}];")
    for i in range(n):
        lines.append(f"measure q[{i}] -> c[{i}];")
    gc = layers * (2 * n + (n - 1) // 2 + 1) + n
    return {
        "qasm": "\n".join(lines),
        "qubits": n,
        "depth": layers * 3,
        "gate_count": gc,
        "param_summary": f"{n} qubits, {layers} ansatz layer(s), Ry/Rz from data",
    }


def build_qaoa(p: dict) -> dict:
    n = max(2, min(p["qubits"], 14))
    depth = max(1, round(p["complexity"] * 4) + 1)
    angles = p["angles"]
    lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', f"qreg q[{n}];", f"creg c[{n}];"]
    for i in range(n):
        lines.append(f"h q[{i}];")
    idx = 0
    for _ in range(depth):
        for i in range(n - 1):
            γ = f"{angles[idx % len(angles)]:.6f}"; idx += 1
            lines.append(f"cx q[{i}],q[{i+1}];")
            lines.append(f"rz({γ}) q[{i+1}];")
            lines.append(f"cx q[{i}],q[{i+1}];")
        for i in range(n):
            β = f"{angles[idx % len(angles)]:.6f}"; idx += 1
            lines.append(f"rx({β}) q[{i}];")
    for i in range(n):
        lines.append(f"measure q[{i}] -> c[{i}];")
    gc = n + depth * (3 * (n - 1) + n) + n
    return {
        "qasm": "\n".join(lines),
        "qubits": n,
        "depth": 1 + depth * 4,
        "gate_count": gc,
        "param_summary": f"{n} qubits, {depth} QAOA layer(s), γ/β from data",
    }


def build_qft(p: dict) -> dict:
    n = max(2, min(p["qubits"], 8))
    angles = p["angles"]
    lines = ["OPENQASM 2.0;", 'include "qelib1.inc";', f"qreg q[{n}];", f"creg c[{n}];"]
    for i in range(n):
        θ = f"{angles[i % len(angles)]:.6f}"
        lines.append(f"ry({θ}) q[{i}];")
    for i in range(n):
        lines.append(f"h q[{i}];")
        for j in range(i + 1, n):
            k = j - i + 1
            φ = f"{math.pi / (2 ** (k - 1)):.6f}"
            lines.append(f"cu1({φ}) q[{i}],q[{j}];")
    for i in range(n // 2):
        lines.append(f"swap q[{i}],q[{n-1-i}];")
    for i in range(n):
        lines.append(f"measure q[{i}] -> c[{i}];")
    gc = n + n + n * (n - 1) // 2 + n // 2 + n
    return {
        "qasm": "\n".join(lines),
        "qubits": n,
        "depth": n + n + n // 2,
        "gate_count": gc,
        "param_summary": f"{n}-qubit QFT, Ry init from {p['features']} data features",
    }


BUILDERS = {
    "bell": build_bell,
    "grover": build_grover,
    "shor": build_shor,
    "vqe": build_vqe,
    "qaoa": build_qaoa,
    "qft": build_qft,
}


def build_circuit(algorithm: str, data: Any) -> dict:
    """Public entry point: analyze data → build QASM → return result dict."""
    algo = algorithm.lower()
    builder = BUILDERS.get(algo)
    if not builder:
        raise ValueError(f"Unsupported algorithm '{algorithm}'. Choose: {', '.join(BUILDERS)}")
    profile = analyze(data)
    result = builder(profile)
    result["algorithm"] = algo
    return result


# ─── Private helpers ───────────────────────────────────────────────────────────

def _normalize_rows(data: Any) -> list:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if isinstance(data.get("rows"), list):
            return data["rows"]
        if isinstance(data.get("data"), list):
            return data["data"]
        # Single dict = one row
        return [data]
    if isinstance(data, str):
        try:
            return _normalize_rows(json.loads(data))
        except json.JSONDecodeError:
            return []
    return []


def _numeric_values(row: Any) -> list[float]:
    if isinstance(row, list):
        return [v for v in row if isinstance(v, (int, float))]
    if isinstance(row, dict):
        return [v for v in row.values() if isinstance(v, (int, float))]
    if isinstance(row, (int, float)):
        return [float(row)]
    return []


# ─── CLI entry point ───────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python quantum_circuit_generator.py <algorithm> <data_json>"}))
        sys.exit(1)

    algorithm = sys.argv[1]
    try:
        data = json.loads(sys.argv[2])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    try:
        result = build_circuit(algorithm, data)
        print(json.dumps(result, indent=2))
    except ValueError as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
