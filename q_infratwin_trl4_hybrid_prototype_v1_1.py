
# -*- coding: utf-8 -*-
"""
Q-InfraTwin — TRL4 Hybrid (Quantum–Classical) Prototype (single-file)

What this prototype adds vs your TRL2 v4 notebook:
- Formal Quantum Request Envelope (QRE) and normalised result envelope
- Provider-agnostic Quantum Gateway interface (submit/poll/get_result)
- Simulated cloud QPU queue, noise proxy, cost proxy, and failure modes (TRL4 governance)
- Hybrid Orchestrator with: eligibility gates + value heuristic + latency + fallback
- Result validation before applying to the Twin state
- Multi-twin registry (asset/subsystem/system) + topology_ref placeholder
- Run history exported to CSV/JSONL + basic matplotlib visualisations

Dependencies: numpy, pandas, matplotlib (no external services required)
Run:
  python q_infratwin_trl4_hybrid_prototype_v1.py --steps 300 --twins 3 --policy bandit
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, Optional, List, Tuple, Literal
from datetime import datetime, timezone

import numpy as np
import pandas as pd
try:
    import matplotlib.pyplot as plt
    _HAS_MPL = True
except ModuleNotFoundError:
    plt = None
    _HAS_MPL = False


# -----------------------------
# Data contracts (TRL4-ready)
# -----------------------------

RiskClass = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW"]
Route = Literal["CLASSICAL", "QUANTUM", "FALLBACK_CLASSICAL"]
JobStatus = Literal["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@dataclass
class Telemetry:
    source_id: str
    ts: str
    values: Dict[str, float]


@dataclass
class TwinState:
    twin_id: str
    level: Literal["asset", "subsystem", "system", "sos"]
    topology_ref: str
    ts: str
    # Minimal state vector (extend for your infrastructure domain)
    x1: float = 0.0
    x2: float = 0.0
    x3: float = 0.0
    # Derived
    health: float = 1.0
    last_action: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SLA:
    deadline_ms: int = 20000
    max_queue_ms: int = 60000
    max_cost_eur: float = 3.0
    risk_class: RiskClass = "LOW"


@dataclass
class QuantumConfig:
    algorithm: Literal["QAOA", "VQE", "SAMPLING"] = "QAOA"
    shots: int = 2000
    depth: int = 3
    backend_preference: List[Literal["QPU", "SIMULATOR"]] = field(default_factory=lambda: ["QPU", "SIMULATOR"])
    seed: int = 42


@dataclass
class QRE:
    qre_version: str
    twin_context: Dict[str, Any]
    problem: Dict[str, Any]
    sla: SLA
    quantum_config: QuantumConfig
    fallback: Dict[str, Any]
    trace: Dict[str, Any]


@dataclass
class QuantumResult:
    correlation_id: str
    step_id: int
    backend: Dict[str, Any]
    status: JobStatus
    solution: Dict[str, Any]
    diagnostics: Dict[str, Any]
    error: Optional[str] = None


@dataclass
class ExecRecord:
    step_id: int
    ts: str
    twin_id: str
    route: Route
    policy: str
    qpu_queue_ms: Optional[int]
    exec_ms: int
    latency_breach: bool
    fallback_reasons: List[str]
    objective_value: float
    confidence: float
    noise_proxy: Optional[float]
    cost_eur: Optional[float]
    # for audit
    qre_json: Optional[str] = None
    result_json: Optional[str] = None


# -----------------------------
# Edge telemetry simulators
# -----------------------------

class EdgeAgentSim:
    """Synthetic telemetry generator for an asset-like twin."""
    def __init__(self, source_id: str, seed: int = 42):
        self.source_id = source_id
        self.rng = np.random.default_rng(seed)
        self.t = 0

    def step(self) -> Telemetry:
        self.t += 1
        # signals (can be mapped to demand, load, pressure, vibration, etc.)
        x1 = np.sin(self.t / 6) + 0.05 * self.rng.normal()
        x2 = np.cos(self.t / 8) + 0.05 * self.rng.normal()
        x3 = (self.t % 20) / 20 + 0.05 * self.rng.normal()
        return Telemetry(
            source_id=self.source_id,
            ts=utc_now_iso(),
            values={"x1": float(x1), "x2": float(x2), "x3": float(x3)}
        )


# -----------------------------
# Twin runtime (TwinCORE-lite++)
# -----------------------------

class TwinCORE:
    """Minimal registry + hierarchical twin state manager + history store."""
    def __init__(self):
        self.registry: Dict[str, TwinState] = {}
        self.history: List[ExecRecord] = []

    def create_twin(self, twin_id: str, level: str, topology_ref: str) -> TwinState:
        st = TwinState(
            twin_id=twin_id,
            level=level,  # asset/subsystem/system/sos
            topology_ref=topology_ref,
            ts=utc_now_iso(),
        )
        self.registry[twin_id] = st
        return st

    def update_from_telemetry(self, twin_id: str, tel: Telemetry) -> TwinState:
        st = self.registry[twin_id]
        st.ts = tel.ts
        st.x1 = tel.values.get("x1", st.x1)
        st.x2 = tel.values.get("x2", st.x2)
        st.x3 = tel.values.get("x3", st.x3)
        # simple "health" proxy
        st.health = float(np.clip(1.0 - 0.15 * abs(st.x1) - 0.10 * abs(st.x2), 0.0, 1.0))
        return st

    def apply_action(self, twin_id: str, action: Dict[str, Any]) -> TwinState:
        st = self.registry[twin_id]
        st.last_action = action
        # optionally affect state (closed-loop simulation hook)
        # Here: a tiny damping effect if "dispatch" is used.
        damp = float(action.get("damp", 0.0))
        if damp:
            st.x1 *= (1 - 0.02 * damp)
            st.x2 *= (1 - 0.02 * damp)
        return st

    def append_record(self, rec: ExecRecord) -> None:
        self.history.append(rec)

    def dataframe(self) -> pd.DataFrame:
        return pd.DataFrame([asdict(r) for r in self.history])


# -----------------------------
# Feature extraction / problem builder
# -----------------------------

class FeatureExtractor:
    """Builds routing features and a QUBO-like payload from the current twin state."""
    def __init__(self, window: int = 12):
        self.window = window
        self.buffers: Dict[str, List[Tuple[float, float, float]]] = {}

    def update(self, st: TwinState) -> Dict[str, float]:
        buf = self.buffers.setdefault(st.twin_id, [])
        buf.append((st.x1, st.x2, st.x3))
        if len(buf) > self.window:
            buf.pop(0)

        arr = np.array(buf, dtype=float)
        mu = arr.mean(axis=0)
        sig = arr.std(axis=0) + 1e-6

        # "discrete_ratio" proxy: if x3 close to discretised ladder
        ladder = np.round(arr[:, 2] * 10) / 10
        discrete_ratio = float(np.mean(np.isclose(arr[:, 2], ladder, atol=0.03)))

        return {
            "mu1": float(mu[0]), "mu2": float(mu[1]), "mu3": float(mu[2]),
            "sig1": float(sig[0]), "sig2": float(sig[1]), "sig3": float(sig[2]),
            "discrete_ratio": discrete_ratio,
            "health": float(st.health),
        }

    def build_qubo_stub(self, features: Dict[str, float], n_vars: int) -> Dict[str, Any]:
        # TRL4 note: For real use-cases, you will encode your graph scheduling/routing/switching
        # into linear + quadratic terms. Here we keep a compact stub for the gateway contract.
        # We'll generate a sparse synthetic QUBO with a few terms to carry shape.
        rng = np.random.default_rng(int(abs(features["mu1"] * 10000)) % 2**32)
        linear = []
        quad = []
        # a few linear biases
        for i in rng.choice(n_vars, size=min(12, n_vars), replace=False):
            linear.append([f"x{i}", float(rng.normal(scale=0.5))])
        # a few quadratic couplings
        for _ in range(min(20, n_vars)):
            i, j = rng.choice(n_vars, size=2, replace=False)
            quad.append([[f"x{i}", f"x{j}"], float(rng.normal(scale=0.25))])

        return {"linear": linear, "quadratic": quad}


# -----------------------------
# Classical solver (baseline)
# -----------------------------

class ClassicalSolver:
    """Deterministic baseline solver producing a safe action and objective."""
    def solve(self, st: TwinState, features: Dict[str, float]) -> Tuple[Dict[str, Any], float, float]:
        # Objective: keep system stable + 'cost' of acting.
        # Action: choose a damping factor based on signal magnitude.
        mag = abs(st.x1) + abs(st.x2)
        damp = float(np.clip(mag * 2.0, 0.0, 5.0))
        objective = float(-(1.2 * (mag) + 0.3 * abs(st.x3) + 0.05 * damp))
        confidence = float(np.clip(0.85 - 0.10 * features["sig1"], 0.4, 0.9))
        action = {"damp": damp, "mode": "baseline_classical"}
        return action, objective, confidence


# -----------------------------
# Quantum Gateway (TRL4 cloud access — simulated)
# -----------------------------

@dataclass
class JobHandle:
    job_id: str
    submit_ts: float
    ready_ts: float
    qre: QRE
    status: JobStatus = "PENDING"


class QuantumGateway:
    """Provider-agnostic interface. In TRL4 you'd implement real provider adapters here."""
    def submit(self, qre: QRE) -> JobHandle:
        raise NotImplementedError

    def poll(self, handle: JobHandle) -> JobStatus:
        raise NotImplementedError

    def get_result(self, handle: JobHandle) -> QuantumResult:
        raise NotImplementedError


class SimulatedCloudQPU(QuantumGateway):
    """
    Simulates cloud-accessed quantum compute with:
    - queue time distribution
    - execution time
    - failure probability
    - noise proxy
    - cost proxy

    This is perfect for TRL4 SIL validation and for exercising fallback/latency governance.
    """
    def __init__(self, seed: int = 42):
        self.rng = np.random.default_rng(seed)
        self._job_counter = 0

    def _new_job_id(self) -> str:
        self._job_counter += 1
        return f"qjob-{self._job_counter:06d}"

    def submit(self, qre: QRE) -> JobHandle:
        job_id = self._new_job_id()
        now = time.time()

        # queue estimate influenced by risk/deadline + n_vars
        n_vars = int(qre.problem.get("variables", 200))
        base_queue = float(np.clip(self.rng.gamma(shape=2.0, scale=6000.0), 1000.0, 90000.0))
        queue_ms = base_queue + 2.0 * n_vars

        # execution time influenced by shots*depth
        shots = int(qre.quantum_config.shots)
        depth = int(qre.quantum_config.depth)
        exec_ms = float(np.clip(150.0 + 0.02 * shots + 120.0 * depth + self.rng.normal(scale=30.0), 150.0, 4000.0))

        ready_ts = now + (queue_ms + exec_ms) / 1000.0

        return JobHandle(job_id=job_id, submit_ts=now, ready_ts=ready_ts, qre=qre, status="PENDING")

    def poll(self, handle: JobHandle) -> JobStatus:
        now = time.time()
        if handle.status in ("SUCCEEDED", "FAILED", "CANCELLED"):
            return handle.status
        if now < handle.submit_ts + 0.2:
            handle.status = "PENDING"
        elif now < handle.ready_ts:
            handle.status = "RUNNING"
        else:
            # terminal state decided in get_result
            handle.status = "RUNNING"
        return handle.status

    def get_result(self, handle: JobHandle) -> QuantumResult:
        # Ensure time reached
        now = time.time()
        if now < handle.ready_ts:
            # Not ready; emulate provider behaviour
            return QuantumResult(
                correlation_id=handle.qre.trace["correlation_id"],
                step_id=int(handle.qre.trace["step_id"]),
                backend={"provider": "SIM_QPU", "backend_id": "sim-qpu-1", "mode": "QPU", "queue_ms": None, "exec_ms": None},
                status="PENDING",
                solution={},
                diagnostics={},
                error="Result requested before ready"
            )

        qre = handle.qre
        n_vars = int(qre.problem.get("variables", 200))
        risk = qre.sla.risk_class

        # Failure probability increases with size + risk
        base_fail = 0.03 + 0.00002 * n_vars
        if risk == "HIGH":
            base_fail += 0.03
        elif risk == "CRITICAL":
            base_fail += 0.06

        failed = bool(self.rng.random() < base_fail)

        # Noise proxy increases with depth and (a bit) with n_vars
        depth = int(qre.quantum_config.depth)
        noise_proxy = float(np.clip(0.03 + 0.02 * depth + 0.00001 * n_vars + self.rng.normal(scale=0.005), 0.0, 0.25))

        # Cost proxy
        shots = int(qre.quantum_config.shots)
        cost_eur = float(np.clip(0.25 + 0.0002 * shots + 0.003 * depth + 0.00001 * n_vars, 0.1, 10.0))

        if failed:
            handle.status = "FAILED"
            return QuantumResult(
                correlation_id=qre.trace["correlation_id"],
                step_id=int(qre.trace["step_id"]),
                backend={"provider": "SIM_QPU", "backend_id": "sim-qpu-1", "mode": "QPU", "queue_ms": int((handle.ready_ts-handle.submit_ts)*1000), "exec_ms": None},
                status="FAILED",
                solution={},
                diagnostics={"noise_proxy": noise_proxy, "cost_eur": cost_eur},
                error="Simulated QPU job failure"
            )

        # Produce a synthetic "best bitstring" and decode to an action
        bitstring = "".join("1" if x > 0 else "0" for x in self.rng.normal(size=min(64, n_vars)))
        # Use bit density to define a damp action; pretend it comes from an optimisation
        ones = bitstring.count("1")
        damp = float(np.clip(0.5 + 5.0 * ones / max(1, len(bitstring)), 0.0, 5.0))

        # Synthetic objective: slightly better than classical when noise small
        objective = float(-(0.9 + 1.5 * noise_proxy) * (0.8 + self.rng.random()))
        confidence = float(np.clip(0.80 - 1.8 * noise_proxy, 0.2, 0.85))

        handle.status = "SUCCEEDED"
        return QuantumResult(
            correlation_id=qre.trace["correlation_id"],
            step_id=int(qre.trace["step_id"]),
            backend={
                "provider": "SIM_QPU",
                "backend_id": "sim-qpu-1",
                "mode": "QPU",
                "queue_ms": int((handle.ready_ts - handle.submit_ts) * 1000),
                "exec_ms": int(150 + 0.02 * shots + 120 * depth),
            },
            status="SUCCEEDED",
            solution={
                "best_bitstring": bitstring,
                "decoded_decision": {"damp": damp, "mode": "quantum_candidate"},
                "objective_value": objective,
                "confidence": confidence
            },
            diagnostics={"shots": shots, "depth": depth, "noise_proxy": noise_proxy, "cost_eur": cost_eur}
        )


# -----------------------------
# Governance: eligibility, latency, fallback, validation
# -----------------------------

class LatencyController:
    def __init__(self, deadline_ms: int):
        self.deadline_ms = int(deadline_ms)

    def breach(self, elapsed_ms: int) -> bool:
        return int(elapsed_ms) > self.deadline_ms


class FallbackManager:
    def __init__(self, max_queue_ms: int, max_cost_eur: float, max_noise: float = 0.15):
        self.max_queue_ms = int(max_queue_ms)
        self.max_cost_eur = float(max_cost_eur)
        self.max_noise = float(max_noise)

    def should_fallback(self, status: JobStatus, queue_ms: Optional[int], cost_eur: Optional[float], noise_proxy: Optional[float]) -> Tuple[bool, List[str]]:
        reasons: List[str] = []
        if status in ("FAILED", "CANCELLED"):
            reasons.append("JOB_FAILED")
        if queue_ms is not None and queue_ms > self.max_queue_ms:
            reasons.append("QUEUE_TIMEOUT")
        if cost_eur is not None and cost_eur > self.max_cost_eur:
            reasons.append("COST_BREACH")
        if noise_proxy is not None and noise_proxy > self.max_noise:
            reasons.append("NOISE_TOO_HIGH")
        return (len(reasons) > 0), reasons


class ResultValidator:
    def validate(self, qr: QuantumResult) -> Tuple[bool, List[str]]:
        reasons: List[str] = []
        if qr.status != "SUCCEEDED":
            reasons.append("NOT_SUCCEEDED")
            return False, reasons
        sol = qr.solution or {}
        if "decoded_decision" not in sol:
            reasons.append("MISSING_DECISION")
        else:
            damp = sol["decoded_decision"].get("damp", None)
            if damp is None or not (0.0 <= float(damp) <= 5.0):
                reasons.append("DECISION_OUT_OF_BOUNDS")
        if "objective_value" not in sol:
            reasons.append("MISSING_OBJECTIVE")
        return (len(reasons) == 0), reasons


# -----------------------------
# Hybrid routing (rule + bandit)
# -----------------------------

class SimpleRulePolicy:
    def __init__(self, min_discrete_ratio: float = 0.6, min_health: float = 0.25):
        self.min_discrete_ratio = float(min_discrete_ratio)
        self.min_health = float(min_health)

    def choose(self, features: Dict[str, float], sla: SLA) -> Route:
        # hard gate: critical always classical
        if sla.risk_class == "CRITICAL":
            return "CLASSICAL"
        if features["health"] < self.min_health:
            return "CLASSICAL"
        if features["discrete_ratio"] >= self.min_discrete_ratio and sla.deadline_ms >= 15000:
            return "QUANTUM"
        return "CLASSICAL"


class ContextualBanditPolicy:
    """
    Minimal contextual bandit for routing:
    - actions: classical or quantum
    - reward: objective_value - latency_penalty - fallback_penalty
    """
    def __init__(self, seed: int = 7, eps: float = 0.12):
        self.rng = np.random.default_rng(seed)
        self.eps = float(eps)
        # weights for features -> preference score
        self.w = self.rng.normal(scale=0.05, size=6)  # small model
        self.b = 0.0

    def _phi(self, features: Dict[str, float], sla: SLA) -> np.ndarray:
        return np.array([
            features["discrete_ratio"],
            features["health"],
            np.clip(features["sig1"], 0, 1),
            np.clip(features["sig2"], 0, 1),
            float(sla.deadline_ms) / 60000.0,
            1.0 if sla.risk_class in ("HIGH", "MEDIUM") else 0.0
        ], dtype=float)

    def choose(self, features: Dict[str, float], sla: SLA) -> Route:
        if sla.risk_class == "CRITICAL":
            return "CLASSICAL"
        if self.rng.random() < self.eps:
            return "QUANTUM" if self.rng.random() < 0.5 else "CLASSICAL"
        score = float(self.w @ self._phi(features, sla) + self.b)
        return "QUANTUM" if score > 0 else "CLASSICAL"

    def update(self, features: Dict[str, float], sla: SLA, route: Route, reward: float) -> None:
        # simple gradient step treating reward as label
        lr = 0.05
        phi = self._phi(features, sla)
        pred = float(self.w @ phi + self.b)
        # target: positive reward => push towards QUANTUM, else towards CLASSICAL
        y = 1.0 if reward > 0 else -1.0
        err = y - np.tanh(pred)
        self.w += lr * err * phi
        self.b += lr * err


# -----------------------------
# Hybrid Orchestrator
# -----------------------------

class HybridOrchestrator:
    def __init__(
        self,
        gateway: QuantumGateway,
        classical: ClassicalSolver,
        extractor: FeatureExtractor,
        policy: str = "rule",
        seed: int = 42
    ):
        self.gateway = gateway
        self.classical = classical
        self.extractor = extractor
        self.policy_name = policy
        self.rule = SimpleRulePolicy()
        self.bandit = ContextualBanditPolicy(seed=seed) if policy == "bandit" else None

    def _make_sla(self, risk: RiskClass) -> SLA:
        # You can make SLA conditional on risk or infrastructure domain
        return SLA(
            deadline_ms=20000 if risk != "HIGH" else 25000,
            max_queue_ms=60000,
            max_cost_eur=3.0,
            risk_class=risk
        )

    def _risk_classify(self, st: TwinState, features: Dict[str, float]) -> RiskClass:
        # simple: low health -> higher risk
        if features["health"] < 0.15:
            return "CRITICAL"
        if features["health"] < 0.35:
            return "HIGH"
        if features["health"] < 0.60:
            return "MEDIUM"
        return "LOW"

    def _build_qre(self, st: TwinState, features: Dict[str, float], sla: SLA, step_id: int, correlation_id: str) -> QRE:
        # Determine problem size: grows when discrete_ratio high (proxy for combinatorial)
        n_vars = int(200 + 1400 * features["discrete_ratio"])
        qubo = self.extractor.build_qubo_stub(features, n_vars=n_vars)

        problem = {
            "type": "COMBINATORIAL_OPT",
            "form": "QUBO",
            "objective": "min_cost_with_constraints",
            "variables": n_vars,
            "discrete_ratio": float(features["discrete_ratio"]),
            "qubo": qubo,
            "constraints_hint": [
                {"name": "stability", "type": "penalty", "weight": 10.0},
                {"name": "safety_bounds", "type": "hard_or_penalty", "weight": 50.0}
            ]
        }

        qc = QuantumConfig(algorithm="QAOA", shots=2000, depth=3, seed=42)
        return QRE(
            qre_version="1.0",
            twin_context={
                "twin_id": st.twin_id,
                "level": st.level,
                "topology_ref": st.topology_ref,
                "timestamp": st.ts
            },
            problem=problem,
            sla=sla,
            quantum_config=qc,
            fallback={
                "policy": "CLASSICAL_ON_FAILURE",
                "reasons_to_trigger": ["QUEUE_TIMEOUT", "JOB_FAILED", "NOISE_TOO_HIGH", "COST_BREACH", "SLA_BREACH"]
            },
            trace={"correlation_id": correlation_id, "step_id": step_id}
        )

    def decide_route(self, features: Dict[str, float], sla: SLA) -> Route:
        if self.policy_name == "bandit" and self.bandit is not None:
            return self.bandit.choose(features, sla)
        return self.rule.choose(features, sla)

    def step(self, st: TwinState, step_id: int, correlation_id: str) -> Tuple[Dict[str, Any], ExecRecord]:
        t0 = time.time()

        features = self.extractor.update(st)
        risk = self._risk_classify(st, features)
        sla = self._make_sla(risk)

        route = self.decide_route(features, sla)
        latency_ctrl = LatencyController(deadline_ms=sla.deadline_ms)
        fallback_mgr = FallbackManager(max_queue_ms=sla.max_queue_ms, max_cost_eur=sla.max_cost_eur)
        validator = ResultValidator()

        qre_json = None
        result_json = None
        qpu_queue_ms = None
        noise_proxy = None
        cost_eur = None
        fallback_reasons: List[str] = []

        # Default to classical
        action, obj, conf = self.classical.solve(st, features)
        final_route: Route = "CLASSICAL"

        if route == "QUANTUM":
            qre = self._build_qre(st, features, sla, step_id, correlation_id)
            qre_json = json.dumps(asdict(qre), default=str)

            handle = self.gateway.submit(qre)
            # Poll until ready or until deadline is close; TRL4 orchestration would be async.
            while True:
                status = self.gateway.poll(handle)
                if status in ("SUCCEEDED", "FAILED", "CANCELLED"):
                    break
                # Break if likely to breach SLA (simple guard)
                elapsed_ms = int((time.time() - t0) * 1000)
                if elapsed_ms > int(0.90 * sla.deadline_ms):
                    status = "CANCELLED"
                    handle.status = "CANCELLED"
                    break
                time.sleep(0.02)

            qr = self.gateway.get_result(handle)
            result_json = json.dumps(asdict(qr), default=str)

            # Extract governance-relevant metadata
            qpu_queue_ms = qr.backend.get("queue_ms") if qr.backend else None
            noise_proxy = qr.diagnostics.get("noise_proxy") if qr.diagnostics else None
            cost_eur = qr.diagnostics.get("cost_eur") if qr.diagnostics else None

            valid, val_reasons = validator.validate(qr)
            fallback, reasons = fallback_mgr.should_fallback(qr.status, qpu_queue_ms, cost_eur, noise_proxy)
            fallback_reasons = reasons + (["RESULT_INVALID"] if not valid else []) + (val_reasons if not valid else [])

            if fallback or not valid:
                final_route = "FALLBACK_CLASSICAL"
                action, obj, conf = self.classical.solve(st, features)
            else:
                final_route = "QUANTUM"
                action = qr.solution["decoded_decision"]
                obj = float(qr.solution["objective_value"])
                conf = float(qr.solution.get("confidence", 0.5))

        elapsed_ms = int((time.time() - t0) * 1000)
        breach = latency_ctrl.breach(elapsed_ms)
        if breach:
            # If we breached and ended up on quantum, prefer to mark a governance breach
            fallback_reasons = fallback_reasons + ["SLA_BREACH"]
            if final_route == "QUANTUM":
                final_route = "FALLBACK_CLASSICAL"
                action, obj, conf = self.classical.solve(st, features)

        # Update bandit with realised reward (if used)
        if self.policy_name == "bandit" and self.bandit is not None:
            # reward: objective - penalties
            reward = float(obj)
            reward -= 0.0008 * elapsed_ms
            if final_route == "FALLBACK_CLASSICAL":
                reward -= 0.2
            self.bandit.update(features, sla, final_route, reward)

        rec = ExecRecord(
            step_id=step_id,
            ts=st.ts,
            twin_id=st.twin_id,
            route=final_route,
            policy=self.policy_name,
            qpu_queue_ms=qpu_queue_ms,
            exec_ms=elapsed_ms,
            latency_breach=bool(breach),
            fallback_reasons=fallback_reasons,
            objective_value=float(obj),
            confidence=float(conf),
            noise_proxy=noise_proxy,
            cost_eur=cost_eur,
            qre_json=qre_json,
            result_json=result_json
        )
        return action, rec


# -----------------------------
# Runner + exports + plots
# -----------------------------

def run_sim(steps: int, twins: int, policy: str, seed: int = 42) -> Tuple[TwinCORE, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    core = TwinCORE()

    # Create some twins and edge agents
    agents: Dict[str, EdgeAgentSim] = {}
    for i in range(twins):
        twin_id = f"infra:asset:{i+1:03d}"
        core.create_twin(twin_id=twin_id, level="asset", topology_ref="graph://infra_demo_v1")
        agents[twin_id] = EdgeAgentSim(source_id=twin_id, seed=int(rng.integers(1, 10_000)))

    extractor = FeatureExtractor(window=12)
    classical = ClassicalSolver()
    gateway = SimulatedCloudQPU(seed=seed)
    orch = HybridOrchestrator(gateway=gateway, classical=classical, extractor=extractor, policy=policy, seed=seed)

    correlation_id = f"run-{int(time.time())}"
    step_id = 0

    for _ in range(steps):
        step_id += 1
        # round-robin among twins
        twin_id = list(agents.keys())[step_id % len(agents)]
        tel = agents[twin_id].step()
        st = core.update_from_telemetry(twin_id, tel)

        action, rec = orch.step(st, step_id=step_id, correlation_id=correlation_id)
        core.apply_action(twin_id, action)
        core.append_record(rec)

    df = core.dataframe()
    return core, df


def export_run(df: pd.DataFrame, prefix: str = "q_infratwin_trl4_run") -> Dict[str, str]:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = f"{prefix}_{ts}.csv"
    jsonl_path = f"{prefix}_{ts}.jsonl"

    df.to_csv(csv_path, index=False)

    with open(jsonl_path, "w", encoding="utf-8") as f:
        for _, row in df.iterrows():
            rec = row.to_dict()
            # keep JSON strings as-is
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    return {"csv": csv_path, "jsonl": jsonl_path}


def plot_summary(df: pd.DataFrame, title: str = "Q-InfraTwin TRL4 Hybrid Prototype"):
    if plt is None:
        raise RuntimeError("matplotlib is not installed")
    # Route counts
    plt.figure()
    df["route"].value_counts().plot(kind="bar")
    plt.title(f"{title} — Route counts")
    plt.xlabel("route")
    plt.ylabel("count")
    plt.tight_layout()

    # Latency
    plt.figure()
    df["exec_ms"].plot(kind="hist", bins=30)
    plt.title(f"{title} — Step latency (ms)")
    plt.xlabel("exec_ms")
    plt.ylabel("frequency")
    plt.tight_layout()

    # Objective over time
    plt.figure()
    df["objective_value"].rolling(10).mean().plot()
    plt.title(f"{title} — Objective (rolling mean)")
    plt.xlabel("step")
    plt.ylabel("objective_value")
    plt.tight_layout()

    # Fallback rate
    plt.figure()
    fb = (df["route"] == "FALLBACK_CLASSICAL").astype(int).rolling(20).mean()
    fb.plot()
    plt.title(f"{title} — Fallback rate (rolling mean)")
    plt.xlabel("step")
    plt.ylabel("fallback_rate")
    plt.tight_layout()

    plt.show()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=250)
    ap.add_argument("--twins", type=int, default=3)
    ap.add_argument("--policy", type=str, default="rule", choices=["rule", "bandit"])
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--no_plots", action="store_true", help="Run without matplotlib plots")
    args = ap.parse_args()

    core, df = run_sim(steps=args.steps, twins=args.twins, policy=args.policy, seed=args.seed)

    print(df.head(5).to_string(index=False))
    print("\nRoute distribution:\n", df["route"].value_counts().to_string())
    print("\nLatency breach rate:", float(df["latency_breach"].mean()))
    print("Mean objective:", float(df["objective_value"].mean()))

    if args.export:
        out = export_run(df)
        print("\nExported:", out)

    if not args.no_plots:
        if _HAS_MPL:
            plot_summary(df, title=f"Q-InfraTwin TRL4 Hybrid Prototype ({args.policy})")
        else:
            print("\n[plots skipped] matplotlib is not installed. Install with: python -m pip install matplotlib\n")


if __name__ == "__main__":
    main()
