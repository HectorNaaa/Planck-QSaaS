import sys
import os
import re

# Add local Quark compiler path to sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
local_quark_path = os.path.join(script_dir, "quark_compiler")
sys.path.insert(0, local_quark_path)

try:
    from src.circuit import Circuit
    from src.gate import Gate, GateType
    from src.optimizer import GateCancellationPass
except ImportError as e:
    # If import fails, fall back to echoing stdin verbatim to avoid breaking the pipeline
    sys.stderr.write(f"ImportError: {e}\n")
    sys.stdout.write(sys.stdin.read())
    sys.exit(0)

def main():
    qasm_content = sys.stdin.read()
    if not qasm_content.strip():
        return

    # Parse registers and separate operations
    lines = qasm_content.split('\n')
    header_lines = []
    op_lines = []
    measure_lines = []
    
    in_header = True
    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue
        if in_header and (
            line_clean.startswith("OPENQASM") or 
            line_clean.startswith("include") or 
            line_clean.startswith("qreg") or 
            line_clean.startswith("creg") or 
            line_clean.startswith("//")
        ):
            header_lines.append(line_clean)
        else:
            in_header = False
            if line_clean.startswith("measure"):
                measure_lines.append(line_clean)
            else:
                op_lines.append(line_clean)

    # Extract all registers to build qubit flat mapping
    registers = []
    for h in header_lines:
        match = re.search(r'qreg\s+(\w+)\s*\[(\d+)\]\s*;', h)
        if match:
            reg_name = match.group(1)
            size = int(match.group(2))
            registers.append((reg_name, size))
            
    if not registers:
        # Fallback if no registers declared, output original QASM
        sys.stdout.write(qasm_content)
        return

    flat_to_reg = []
    reg_to_flat = {}
    for reg_name, size in registers:
        for idx in range(size):
            flat_idx = len(flat_to_reg)
            flat_to_reg.append((reg_name, idx))
            reg_to_flat[(reg_name, idx)] = flat_idx

    num_qubits = len(flat_to_reg)
    circuit = Circuit(num_qubits)

    # Mapping QASM gate names to GateType
    gate_name_map = {
        "h": GateType.H,
        "x": GateType.X,
        "y": GateType.Y,
        "z": GateType.Z,
        "s": GateType.S,
        "t": GateType.T,
        "cx": GateType.CNOT,
        "rz": GateType.RZ,
        "rx": GateType.RX,
        "ry": GateType.RY,
        "cu1": GateType.CU1,
        "swap": GateType.SWAP
    }

    # Regex patterns
    # 1. Parametric single qubit gate: rx(θ) q[i];
    rx_rot_1 = re.compile(r'^(\w+)\s*\(([^)]+)\)\s+(\w+)\s*\[(\d+)\]\s*;')
    # 2. Parametric two qubit gate: cu1(θ) q[i], q[j];
    rx_rot_2 = re.compile(r'^(\w+)\s*\(([^)]+)\)\s+(\w+)\s*\[(\d+)\]\s*,\s*(\w+)\s*\[(\d+)\]\s*;')
    # 3. Plain single qubit gate: h q[i];
    rx_plain_1 = re.compile(r'^(\w+)\s+(\w+)\s*\[(\d+)\]\s*;')
    # 4. Plain two qubit gate: cx q[i], q[j];
    rx_plain_2 = re.compile(r'^(\w+)\s+(\w+)\s*\[(\d+)\]\s*,\s*(\w+)\s*\[(\d+)\]\s*;')

    for line in op_lines:
        # Ignore comments or barrier lines in operation list
        if line.startswith("//") or line.startswith("barrier"):
            continue

        m1 = rx_rot_1.match(line)
        m2 = rx_rot_2.match(line)
        m3 = rx_plain_1.match(line)
        m4 = rx_plain_2.match(line)

        try:
            if m1:
                name, angle_str, reg, idx = m1.groups()
                gtype = gate_name_map.get(name.lower())
                if gtype:
                    q = reg_to_flat.get((reg, int(idx)))
                    if q is not None:
                        angle = float(angle_str)
                        gate = Gate(gtype, (q,), angle=angle)
                        circuit.add_gate(gate)
            elif m2:
                name, angle_str, reg1, idx1, reg2, idx2 = m2.groups()
                gtype = gate_name_map.get(name.lower())
                if gtype:
                    q1 = reg_to_flat.get((reg1, int(idx1)))
                    q2 = reg_to_flat.get((reg2, int(idx2)))
                    if q1 is not None and q2 is not None:
                        angle = float(angle_str)
                        # For CU1, treat q2 as target and q1 as control
                        gate = Gate(gtype, (q2,), control_qubits=(q1,), angle=angle)
                        circuit.add_gate(gate)
            elif m3:
                name, reg, idx = m3.groups()
                gtype = gate_name_map.get(name.lower())
                if gtype:
                    q = reg_to_flat.get((reg, int(idx)))
                    if q is not None:
                        gate = Gate(gtype, (q,))
                        circuit.add_gate(gate)
            elif m4:
                name, reg1, idx1, reg2, idx2 = m4.groups()
                gtype = gate_name_map.get(name.lower())
                if gtype:
                    q1 = reg_to_flat.get((reg1, int(idx1)))
                    q2 = reg_to_flat.get((reg2, int(idx2)))
                    if q1 is not None and q2 is not None:
                        if gtype == GateType.CNOT:
                            gate = Gate(gtype, (q2,), control_qubits=(q1,))
                        else: # SWAP
                            gate = Gate(gtype, (q1, q2))
                        circuit.add_gate(gate)
        except Exception as e:
            sys.stderr.write(f"Error parsing line '{line}': {e}\n")

    # Optimize the circuit using Quark GateCancellationPass
    optimizer = GateCancellationPass()
    optimized_circuit = optimizer.optimize(circuit)

    # Output optimized QASM
    # Header lines
    for h in header_lines:
        print(h)

    # Format optimized gates back to QASM
    for gate in optimized_circuit.gates:
        gtype = gate.gate_type
        qasm_names = {
            GateType.H: "h",
            GateType.X: "x",
            GateType.Y: "y",
            GateType.Z: "z",
            GateType.S: "s",
            GateType.T: "t",
            GateType.CNOT: "cx",
            GateType.RZ: "rz",
            GateType.RX: "rx",
            GateType.RY: "ry",
            GateType.CU1: "cu1",
            GateType.SWAP: "swap"
        }
        name = qasm_names[gtype]

        if gtype in {GateType.RZ, GateType.RX, GateType.RY}:
            q_idx = gate.target_qubits[0]
            reg_name, idx = flat_to_reg[q_idx]
            print(f"{name}({gate.angle:.6f}) {reg_name}[{idx}];")
        elif gtype == GateType.CU1:
            ctrl_idx = gate.control_qubits[0]
            tgt_idx = gate.target_qubits[0]
            reg_ctrl, idx_ctrl = flat_to_reg[ctrl_idx]
            reg_tgt, idx_tgt = flat_to_reg[tgt_idx]
            print(f"{name}({gate.angle:.6f}) {reg_ctrl}[{idx_ctrl}],{reg_tgt}[{idx_tgt}];")
        elif gtype == GateType.CNOT:
            ctrl_idx = gate.control_qubits[0]
            tgt_idx = gate.target_qubits[0]
            reg_ctrl, idx_ctrl = flat_to_reg[ctrl_idx]
            reg_tgt, idx_tgt = flat_to_reg[tgt_idx]
            print(f"{name} {reg_ctrl}[{idx_ctrl}],{reg_tgt}[{idx_tgt}];")
        elif gtype == GateType.SWAP:
            q1_idx = gate.target_qubits[0]
            q2_idx = gate.target_qubits[1]
            reg1, idx1 = flat_to_reg[q1_idx]
            reg2, idx2 = flat_to_reg[q2_idx]
            print(f"{name} {reg1}[{idx1}],{reg2}[{idx2}];")
        else: # H, X, Y, Z, S, T
            q_idx = gate.target_qubits[0]
            reg_name, idx = flat_to_reg[q_idx]
            print(f"{name} {reg_name}[{idx}];")

    # Measure lines
    for m in measure_lines:
        print(m)

if __name__ == "__main__":
    main()
