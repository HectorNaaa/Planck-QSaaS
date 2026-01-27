
# Q-InfraTwin TRL4 — Control Room Dashboard (Start/Pause/Stop + Speed)
# Run:
#   python -m pip install -r requirements_dashboard_q_infratwin_trl4.txt
#   python -m streamlit run q_infratwin_control_room_trl4.py
#
# Required in same folder (or point path in sidebar):
#   q_infratwin_trl4_hybrid_prototype_v1_1.py

from __future__ import annotations

import os
import time
import json
from typing import Dict, Any, Optional, Tuple

import pandas as pd
import streamlit as st


def _do_rerun():
    # Streamlit version compatibility
    try:
        _do_rerun()
    except Exception:
        try:
            st.experimental_rerun()
        except Exception:
            pass


st.set_page_config(page_title="Q-InfraTwin Control Room", layout="wide")
st.title("Q-InfraTwin — TRL4 Control Room (Hybrid Quantum–Classical)")

st.markdown(
    """
Operate the hybrid Quantum Digital Twin from here:
- ▶ **Start** continuous run
- ⏸ **Pause**
- ⏭ **Single step**
- ⏹ **Stop/Reset**
- Speed selector: **Real-time** (fixed step interval) or **Max speed** (fast loop suggested via repeated reruns)

This uses the TRL4 prototype engine (QRE + Quantum Gateway simulation + fallback + SLA).
"""
)

# -----------------------------
# Engine loader (exec from file)
# -----------------------------
@st.cache_resource
def load_engine(engine_path: str) -> Dict[str, Any]:
    ns: Dict[str, Any] = {}
    with open(engine_path, "r", encoding="utf-8") as f:
        code = f.read()
    exec(code, ns)
    return ns

here = os.path.dirname(os.path.abspath(__file__))
default_engine_path = os.path.join(here, "q_infratwin_trl4_hybrid_prototype_v1_1.py")

# -----------------------------
# Session state initialisation
# -----------------------------
def ss_init():
    ss = st.session_state
    ss.setdefault("engine_loaded", False)
    ss.setdefault("engine_path", default_engine_path)
    ss.setdefault("ns", None)

    ss.setdefault("running", False)
    ss.setdefault("paused", True)
    ss.setdefault("speed_mode", "Real-time")
    ss.setdefault("interval_s", 0.5)
    ss.setdefault("batch_steps", 25)   # for max-speed mode per rerun

    ss.setdefault("policy", "bandit")
    ss.setdefault("twins", 5)
    ss.setdefault("seed", 42)

    ss.setdefault("core", None)
    ss.setdefault("orch", None)
    ss.setdefault("agents", None)
    ss.setdefault("twin_ids", None)
    ss.setdefault("step_id", 0)
    ss.setdefault("correlation_id", None)
    ss.setdefault("records", [])  # list of dicts

ss_init()

# -----------------------------
# Build runtime objects (from engine module)
# -----------------------------
def build_runtime(ns: Dict[str, Any], twins: int, policy: str, seed: int):
    """
    Create the live runtime components, reusing the engine classes:
    TwinCORE, EdgeAgentSim, FeatureExtractor, ClassicalSolver, SimulatedCloudQPU, HybridOrchestrator
    """
    TwinCORE = ns["TwinCORE"]
    EdgeAgentSim = ns["EdgeAgentSim"]
    FeatureExtractor = ns["FeatureExtractor"]
    ClassicalSolver = ns["ClassicalSolver"]
    SimulatedCloudQPU = ns["SimulatedCloudQPU"]
    HybridOrchestrator = ns["HybridOrchestrator"]

    import numpy as np
    rng = np.random.default_rng(int(seed))

    core = TwinCORE()
    agents = {}
    twin_ids = []
    for i in range(int(twins)):
        tid = f"infra:asset:{i+1:03d}"
        core.create_twin(twin_id=tid, level="asset", topology_ref="graph://infra_demo_v1")
        agents[tid] = EdgeAgentSim(source_id=tid, seed=int(rng.integers(1, 10_000)))
        twin_ids.append(tid)

    extractor = FeatureExtractor(window=12)
    classical = ClassicalSolver()
    gateway = SimulatedCloudQPU(seed=int(seed))
    orch = HybridOrchestrator(gateway=gateway, classical=classical, extractor=extractor, policy=str(policy), seed=int(seed))

    return core, orch, agents, twin_ids

def reset_runtime():
    ss = st.session_state
    if not ss["engine_loaded"]:
        st.warning("Engine not loaded yet.")
        return
    ss["core"], ss["orch"], ss["agents"], ss["twin_ids"] = build_runtime(ss["ns"], ss["twins"], ss["policy"], ss["seed"])
    ss["step_id"] = 0
    ss["records"] = []
    ss["correlation_id"] = f"run-{int(time.time())}"
    ss["paused"] = True
    ss["running"] = False

def step_once():
    ss = st.session_state
    core = ss["core"]
    orch = ss["orch"]
    agents = ss["agents"]
    twin_ids = ss["twin_ids"]

    ss["step_id"] += 1
    tid = twin_ids[ss["step_id"] % len(twin_ids)]
    tel = agents[tid].step()
    stt = core.update_from_telemetry(tid, tel)

    action, rec = orch.step(stt, step_id=int(ss["step_id"]), correlation_id=str(ss["correlation_id"]))
    core.apply_action(tid, action)
    core.append_record(rec)

    # store dict version for dashboard
    ss["records"].append(rec.__dict__)

def run_batch(n: int):
    for _ in range(int(n)):
        step_once()

def df_current() -> pd.DataFrame:
    return pd.DataFrame(st.session_state["records"])

# -----------------------------
# Sidebar controls
# -----------------------------
with st.sidebar:
    st.header("Engine")
    st.session_state["engine_path"] = st.text_input("Engine file path", value=st.session_state["engine_path"])

    if st.button("Load engine", use_container_width=True):
        try:
            st.session_state["ns"] = load_engine(st.session_state["engine_path"])
            st.session_state["engine_loaded"] = True
            st.success("Engine loaded.")
        except Exception as e:
            st.session_state["engine_loaded"] = False
            st.error("Failed to load engine.")
            st.exception(e)

    st.divider()
    st.header("Runtime config")
    st.session_state["twins"] = st.slider("Twins", min_value=1, max_value=20, value=int(st.session_state["twins"]), step=1)
    st.session_state["policy"] = st.selectbox("Routing policy", ["rule", "bandit"], index=1 if st.session_state["policy"] == "bandit" else 0)
    st.session_state["seed"] = st.number_input("Seed", min_value=1, max_value=1_000_000, value=int(st.session_state["seed"]), step=1)

    st.divider()
    st.header("Speed")
    st.session_state["speed_mode"] = st.selectbox("Mode", ["Real-time", "Max speed"], index=0 if st.session_state["speed_mode"] == "Real-time" else 1)

    if st.session_state["speed_mode"] == "Real-time":
        st.session_state["interval_s"] = st.slider("Interval (s) per step", min_value=0.05, max_value=2.0, value=float(st.session_state["interval_s"]), step=0.05)
    else:
        st.session_state["batch_steps"] = st.slider("Steps per refresh", min_value=5, max_value=200, value=int(st.session_state["batch_steps"]), step=5)

    st.divider()
    st.header("Controls")

    c1, c2 = st.columns(2)
    with c1:
        if st.button("⏹ Reset", use_container_width=True):
            if not st.session_state["engine_loaded"]:
                st.warning("Load engine first.")
            else:
                reset_runtime()
                st.success("Runtime reset.")
    with c2:
        if st.button("⏭ Single step", use_container_width=True):
            if st.session_state["core"] is None:
                if st.session_state["engine_loaded"]:
                    reset_runtime()
                else:
                    st.warning("Load engine first.")
            step_once()

    c3, c4 = st.columns(2)
    with c3:
        if st.button("▶ Start", use_container_width=True):
            if st.session_state["core"] is None:
                if st.session_state["engine_loaded"]:
                    reset_runtime()
                else:
                    st.warning("Load engine first.")
            st.session_state["running"] = True
            st.session_state["paused"] = False
            _do_rerun()
    with c4:
        if st.button("⏸ Pause", use_container_width=True):
            st.session_state["paused"] = True
            st.session_state["running"] = False
            _do_rerun()

# If first time and engine loaded, initialise runtime
if st.session_state["engine_loaded"] and st.session_state["core"] is None:
    reset_runtime()

# -----------------------------
# Auto-run loop (Streamlit rerun)
# -----------------------------
if st.session_state["running"] and not st.session_state["paused"]:
    if st.session_state["speed_mode"] == "Real-time":
        # run one step per rerun
        step_once()
        time.sleep(float(st.session_state["interval_s"]))
        _do_rerun()
    else:
        # max speed: run a batch per rerun
        run_batch(int(st.session_state["batch_steps"]))
        _do_rerun()

# -----------------------------
# Main dashboard
# -----------------------------
df = df_current()
if df.empty:
    st.info("Load the engine and press ▶ Start or ⏭ Single step.")
    st.stop()

# KPI strip
def metric_row():
    quantum_rate = float((df["route"] == "QUANTUM").mean())
    fallback_rate = float((df["route"] == "FALLBACK_CLASSICAL").mean())
    sla_breach = float(df["latency_breach"].mean())
    mean_lat = float(df["exec_ms"].mean())
    p95_lat = float(df["exec_ms"].quantile(0.95))
    mean_obj = float(df["objective_value"].mean())
    mean_conf = float(df["confidence"].mean())

    c1, c2, c3, c4, c5, c6 = st.columns(6)
    c1.metric("Steps", str(len(df)))
    c2.metric("Quantum rate", f"{quantum_rate*100:.1f}%")
    c3.metric("Fallback rate", f"{fallback_rate*100:.1f}%")
    c4.metric("SLA breach", f"{sla_breach*100:.1f}%")
    c5.metric("p95 latency", f"{p95_lat:.0f} ms")
    c6.metric("Mean objective", f"{mean_obj:.3f}")

    d1, d2, d3, d4, d5, d6 = st.columns(6)
    d1.metric("Mean latency", f"{mean_lat:.0f} ms")
    d2.metric("Mean confidence", f"{mean_conf:.2f}")
    d3.metric("Policy", str(df["policy"].iloc[-1]))
    d4.metric("Mode", st.session_state["speed_mode"])
    d5.metric("Twin count", str(df["twin_id"].nunique()))
    q = df["qpu_queue_ms"].dropna()
    d6.metric("Mean queue", "—" if q.empty else f"{float(q.mean()):.0f} ms")

metric_row()
st.divider()

left, right = st.columns([2, 1])

with left:
    st.subheader("Objective & latency (live)")
    plot_df = df.copy()
    plot_df["step"] = range(1, len(plot_df) + 1)
    st.line_chart(plot_df.set_index("step")[["objective_value"]], height=220)
    st.line_chart(plot_df.set_index("step")[["exec_ms"]], height=220)

with right:
    st.subheader("Routing distribution")
    st.bar_chart(df["route"].value_counts())

    st.subheader("Fallback reasons (top)")
    reasons = []
    for x in df["fallback_reasons"].fillna(""):
        if isinstance(x, list):
            reasons.extend(x)
        elif isinstance(x, str) and x.startswith("["):
            try:
                reasons.extend(json.loads(x.replace("'", '"')))
            except Exception:
                reasons.extend([r.strip().strip('"').strip("'") for r in x.strip("[]").split(",") if r.strip()])
        elif isinstance(x, str) and x:
            reasons.append(x)
    if reasons:
        st.bar_chart(pd.Series(reasons).value_counts().head(10))
    else:
        st.caption("No fallback reasons recorded.")

st.divider()

# Per-twin drill-down
st.subheader("Per-twin drill-down (live)")
twin_ids = sorted(df["twin_id"].unique().tolist())
sel = st.selectbox("Select twin_id", twin_ids, index=0)

dft = df[df["twin_id"] == sel].copy()
dft["step"] = range(1, len(dft) + 1)

a1, a2 = st.columns(2)
with a1:
    st.line_chart(dft.set_index("step")[["objective_value"]], height=220)
    st.line_chart(dft.set_index("step")[["exec_ms"]], height=220)

with a2:
    st.bar_chart(dft["route"].value_counts())
    q2 = dft["qpu_queue_ms"].dropna()
    if not q2.empty:
        st.line_chart(dft.set_index("step")[["qpu_queue_ms"]], height=220)

st.divider()

# Audit inspection
st.subheader("Audit inspector (QRE / Result)")
cols = ["step_id", "ts", "twin_id", "route", "exec_ms", "qpu_queue_ms", "noise_proxy", "cost_eur", "latency_breach"]
st.dataframe(df[cols].tail(50), use_container_width=True, height=260)

row_idx = st.number_input("Pick a row index (0-based)", min_value=0, max_value=max(0, len(df) - 1), value=max(0, len(df) - 1), step=1)
row = df.iloc[int(row_idx)]

def safe_json(s):
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return None
    try:
        return json.loads(s)
    except Exception:
        return None

qre_obj = safe_json(row.get("qre_json"))
res_obj = safe_json(row.get("result_json"))

b1, b2 = st.columns(2)
with b1:
    st.markdown("**QRE**")
    if qre_obj:
        st.json(qre_obj)
    else:
        st.caption("No QRE (classical step).")
with b2:
    st.markdown("**Quantum Result**")
    if res_obj:
        st.json(res_obj)
    else:
        st.caption("No quantum result recorded.")

st.divider()

# Export
st.subheader("Export current run")
csv_bytes = df.to_csv(index=False).encode("utf-8")
st.download_button("Download CSV", data=csv_bytes, file_name="q_infratwin_live_run.csv", mime="text/csv", use_container_width=True)
