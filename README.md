# Planck-QSaaS — Internal Platform Documentation

> **Private — Planck Technologies**
> Hybrid Quantum Digital Twins SaaS · Internal team use only

<img width="2669" height="585" alt="Planck QSaaS Banner" src="https://github.com/user-attachments/assets/beea1cff-1c81-481a-a95e-e47b2f834d85" />


[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/HectorNaaa/Planck-QSaaS)

---

## What is this repository?

This is the main product repository for Planck Technologies. It contains the entire web platform, API, backend logic, and the Python SDK we publish to PyPI. It is a monorepo — everything lives together, no separate services, no microservice maze to navigate.

The product is a SaaS platform that lets researchers, engineers, and companies run quantum circuits on their own data without needing to know QASM, without managing quantum hardware, and without rewriting their existing tech stack. The user uploads a dataset, picks a quantum algorithm, and gets results in seconds alongside a "digital twin" — a persistent digital model that tracks how a quantum representation of their system evolves over time across different datasets and runs.

**Contact:** hello@plancktechnologies.xyz

---

## Table of Contents

1. [What the user actually does](#1-what-the-user-actually-does)
2. [How the system is structured](#2-how-the-system-is-structured)
3. [The web application](#3-the-web-application)
4. [The quantum API layer](#4-the-quantum-api-layer)
5. [The business logic engine (lib/)](#5-the-business-logic-engine-lib)
6. [The C++ native layer](#6-the-c-native-layer)
7. [Digital Twins](#7-digital-twins)
8. [Authentication](#8-authentication)
9. [The database](#9-the-database)
10. [The Python SDK](#10-the-python-sdk)
11. [Real-time dashboard](#11-real-time-dashboard)
12. [The AI assistant](#12-the-ai-assistant)
13. [Billing and plans](#13-billing-and-plans)
14. [Deploying to Vercel](#14-deploying-to-vercel)
15. [Local development](#15-local-development)
16. [Environment variables](#16-environment-variables)
17. [Security](#17-security)

---

## 1. What the user actually does

It helps to walk through the full product experience before diving into code, because the architecture makes a lot more sense when you understand what it needs to support.

The user signs up with their email. Once inside, they land on the **Runner** — the core of the product. They upload a dataset: a CSV with sensor readings, a table of optimization variables, protein folding data, financial time series, or really any numeric array. The platform automatically parses the dataset and derives what we call a "data profile" — how many qubits the circuit needs, what depth it will have, what rotation angles the gates will use. The user doesn't configure any of this. They just upload their data.

They then choose the quantum algorithm that fits their problem. VQE for energy landscape optimization, QAOA for combinatorial optimization, Grover for search problems, QFT for signal analysis, Shor for factorization, or Bell as a baseline entanglement test. They can also adjust advanced parameters like the number of shots (measurement repetitions), the error mitigation strategy, and a backend preference hint.

When they hit Run, the platform generates a parametric QASM 2.0 circuit from their data, optimizes it, selects the best available backend, executes the simulation, and returns the results: qubit probability distribution, success rate, fidelity, runtime, and which backend was used. If the user has Digital Twin mode enabled, the platform also generates a structured insight object for that twin — a JSON blob capturing gate analysis, probability distributions, and ML-generated recommendations for the next run.

The **Dashboard** shows all of this history in real time. Latency charts, backend distribution, success rate over time, a table of all executions. It updates live as new results come in — no page reload required.

From **Settings** the user manages their profile, generates or revokes API keys, changes their theme and language, and can delete their entire execution history or their account entirely (GDPR compliance is built in, not bolted on).

---

## 2. How the system is structured

The platform is a Next.js application deployed on Vercel. There are no microservices. Everything runs inside a single application. Next.js API routes act as the backend, React pages act as the frontend, and SQLite via `better-sqlite3` is the database — living in Vercel's ephemeral `/tmp` directory in production.

The choice of SQLite instead of Postgres is deliberate for this phase. It eliminates the need for external database infrastructure, dramatically reduces cost, and the self-healing JWT mechanism we built compensates for the volatility of Vercel's ephemeral filesystem. When we grow past the point where SQLite works, migrating to Postgres in Neon or PlanetScale will be straightforward since all database access goes through typed wrappers in `lib/db/client.ts`.

There are three logical layers that are worth keeping in your head:

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION LAYER  (app/ + components/)                       │
│                                                                 │
│  React pages and components. Forms, charts, result panels,      │
│  the AI assistant UI. This layer never touches the database     │
│  directly — it only calls the API.                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTP / Server Actions
┌──────────────────────────────▼──────────────────────────────────┐
│  API LAYER  (app/api/)                                          │
│                                                                 │
│  Next.js route handlers running as Vercel Lambdas. Receive      │
│  HTTP requests, authenticate the caller, validate inputs,       │
│  coordinate business logic, return JSON responses. Each         │
│  handler delegates complex work to lib/.                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │  Direct function calls (server-only)
┌──────────────────────────────▼──────────────────────────────────┐
│  BUSINESS LOGIC LAYER  (lib/)                                   │
│                                                                 │
│  The brain of the platform. Circuit generation, backend         │
│  selection, JWT auth, database wrappers, rate limiting,         │
│  security validation, and the ML engine. Never imported         │
│  from client components.                                        │
└──────────────────────────────┬──────────────────────────────────┘
                               │  child_process.spawn (optional)
┌──────────────────────────────▼──────────────────────────────────┐
│  NATIVE LAYER  (scripts/)                                       │
│                                                                 │
│  C++17 binaries for computationally intensive operations:       │
│  circuit generation for massive datasets, gate-level            │
│  transpilation. Falls back to TypeScript on Vercel where        │
│  binaries are not compiled.                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. The web application

### The landing page

The public marketing page (`app/page.tsx`) is the entry point for visitors. It has the animated quantum hero background, the features section, pricing cards, FAQs, and the footer. It forces light theme on mount because it is the public face of the product and light mode was the design decision for marketing. The Quantum Assistant chat is available here too — visitors can explore what the platform does without registering.

### The authenticated shell

Everything under `/qsaas/` is the protected application. The layout at that level (`app/qsaas/layout.tsx`) wraps all pages in the main shell: a collapsible sidebar on desktop with navigation links, and a bottom tab bar on mobile. When an unauthenticated user tries to access any route under `/qsaas/`, the `ProtectedRoute` component detects the missing `auth-token` cookie and redirects to login automatically — no page-level auth checks needed.

### The Runner

The Runner (`app/qsaas/runner/`) is the most complex page in the product. It is built as a sequence of panels that guide the user through the workflow:

The **data upload panel** accepts CSV and JSON files via drag-and-drop. It validates size (maximum 1MB) and format before sending anything to the server. Once the file is loaded, the **AutoParser** analyzes the dataset structure and shows the user what it derived: how many qubits the circuit will need, how many feature columns it found, what data scale tier it is, and which algorithm it recommends based on that analysis.

The **configuration panel** lets the user choose the algorithm, name the circuit, tune the number of shots, select the error mitigation strategy, and optionally associate the run with a specific Digital Twin.

When the user executes, the **circuit results panel** shows the raw probability distribution as a bar chart with fidelity and success rate badges. The **Digital Twin panel** shows the full insight for that twin. The **Scenario Comparison** at the bottom of the runner lets the user put two past runs side by side to see whether a change in parameters or dataset actually improved the results.

Below all of that, a `DigitalTwinDashboard` component shows the live execution history streaming in via SSE — the runner and the dashboard are not separate experiences; the runner has the dashboard built in.

### The Dashboard

The standalone Dashboard page (`app/qsaas/dashboard/`) shows execution statistics grouped by Digital Twin. Four summary stat cards at the top (total runs, average success rate, average runtime, average qubits used), and then one tab per digital twin the user has created, each rendering its own live charts and runs table.

The interesting design choice here is around data resilience. Vercel's SQLite lives in `/tmp` and can be wiped at any time. So the dashboard has three data sources it merges together on every load: the server database, the localStorage execution cache (up to 100 rows, written by the runner after each execution), and the live SSE stream. Server data takes priority, but the cache fills in gaps when the database has been wiped. The user generally never notices the cold starts.

### Settings

The Settings page manages the full account lifecycle. Profile fields (name, organization, country, occupation), API key generation and revocation, theme and language preferences, and data deletion. There is a subtle but important detail about API key display: once you close the "your new key is" modal, the key is never shown again from the database (it's stored as plaintext there, but we don't want to encourage repeatedly fetching it). Instead, the platform embeds the key in the JWT after generation, so the settings page can show the current active key from the JWT payload without a database round-trip.

---

## 4. The quantum API layer

```
Client request
     │
     ▼
┌────────────────────────────────────────────────────────┐
│  authenticateRequest()  [lib/api-auth.ts]              │
│                                                        │
│  Checks x-api-key header first (SDK/programmatic).     │
│  Falls back to auth-token cookie (browser session).    │
│  Returns userId or throws 401.                         │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  validateInputData() + validateQASM()  [lib/security]  │
│                                                        │
│  Size limits, injection pattern detection,             │
│  structure validation. Rejects bad inputs early        │
│  before any expensive computation happens.             │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  checkRateLimit()  [lib/rate-limiter.ts]               │
│                                                        │
│  Token bucket: 1 request per 3 seconds per user.       │
│  Returns 429 if exceeded. The Python SDK respects       │
│  this automatically by sleeping between calls.         │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  buildCircuit()  [lib/circuit-builder.ts]              │
│                                                        │
│  Converts the dataset into a DataProfile, then         │
│  generates parametric QASM 2.0. For large/massive      │
│  datasets, delegates to the C++ binary via spawn.      │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  recommendParams()  [lib/ml/cpp-ml-engine.ts]          │
│                                                        │
│  Looks up past executions with similar circuit         │
│  profiles and suggests optimal shots, backend,         │
│  and error mitigation with a confidence score.         │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  selectBackendByPolicy()  [lib/backend-policy.ts]      │
│                                                        │
│  Three auditable policies: latency_first (default),    │
│  cost_first, capacity_first. Decision includes         │
│  the reason so it can be inspected by the user.        │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Execute simulation + generate DT insight              │
│                                                        │
│  Run the circuit, collect measurement counts,          │
│  compute fidelity and success rate. If Digital Twin    │
│  mode is on, call /api/quantum/digital-twin to         │
│  generate the insight JSON for this run.               │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│  Executions.create()  [lib/db/client.ts]               │
│                                                        │
│  Persist the full execution record to SQLite.          │
│  Includes circuit_data (DT insight JSON), backend      │
│  decision, metrics, and the original circuit.          │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
              Return ExecutionResult
              to client + SSE stream
              notifies dashboard
```

All quantum endpoints (`/api/quantum/simulate`, `/api/quantum/stream`, `/api/quantum/generate-circuit`, `/api/quantum/transpile`, `/api/quantum/visualize`, `/api/quantum/ml-recommend`, `/api/quantum/digital-twin`, `/api/quantum/assistant`, `/api/quantum/executions`, `/api/quantum/health`) follow the same authentication and validation pattern. The main endpoint `/api/quantum/simulate` does the most work and is the one the Python SDK calls.

The SSE endpoint `/api/quantum/stream` is special — it keeps an HTTP connection open for up to 300 seconds, polling the database every 3 seconds for new rows and pushing them to the client as they arrive. This is how the dashboard updates in real time.

---

## 5. The business logic engine (`lib/`)

### Circuit generation: from data to QASM

`lib/circuit-builder.ts` is the technical heart of the platform. Its entire job is to take an arbitrary user dataset and produce a deterministic, parametric QASM 2.0 circuit. Deterministic is the key word: the same dataset always produces the same circuit. No randomness, no hardcoded gate sequences.

The process has two phases. First, `analyzeInputData()` analyzes the dataset and extracts a data profile. It figures out how many qubits the circuit needs (derived from the number of feature columns and the dataset scale), how many ansatz layers to use, and what rotation angles to embed into the gates (derived from the normalized statistics of the data columns). The user uploads numbers; the platform turns those numbers into angles that become part of the quantum circuit itself. That is how their data "enters" the quantum computation.

The data scale tier matters a lot because it determines the construction strategy:

```
Dataset size          Strategy
────────────────────────────────────────────────────────────────
< 1,000 rows    →  small    Full feature embedding, standard textbook ansatz
< 50,000 rows   →  medium   Sampled statistics, compact entanglement layers
< 10,000,000    →  large    Log-compressed qubit count, amplitude encoding
≥ 10,000,000    →  massive  Maximum qubit compression, repeated amplitude layers
```

The second phase, `buildCircuit()`, takes the profile and generates the full QASM string. For VQE and QAOA it builds a variational ansatz with rotations derived from the data. For Grover it constructs the oracle and diffuser based on the search space implied by the dataset structure. For QFT it applies Fourier rotations adapted to the data scale. For Bell it creates the minimal two-qubit entanglement circuit as a baseline. Nothing is copy-pasted from a textbook — every gate count, angle, and layer number comes from the data.

### Backend selection

`lib/backend-policy.ts` implements three auditable policies:

```
latency_first  (default)  →  Pick the backend with the lowest expected latency
cost_first                →  Pick the cheapest backend that has enough capacity
capacity_first            →  Pick the backend with the most qubit headroom
```

Every decision includes the reason it was made. If the runner shows the user "Backend: simulator-v2 | reason: lowest latency for 8-qubit circuit", that text came directly from the policy module. This makes backend decisions transparent and debuggable. `lib/backend-selector.ts` provides the low-level primitives: `selectOptimalBackend()`, `calculateFidelity()`, and `estimateRuntime()` for a given circuit and backend combination.

### JWT and the cold-start self-healing mechanism

`lib/auth-utils.ts` manages everything related to tokens. JWTs last 7 days and contain the full user profile so that most requests never need to hit the database.

The most interesting thing in this file is `selfHealFromJWT()`. Here is the problem it solves: Vercel runs Next.js as serverless Lambda functions. The SQLite database lives in `/tmp`. Every time a new Lambda instance starts cold (which can happen after any deploy, after a period of inactivity, or just randomly), the `/tmp` directory is empty and the database is gone. If we didn't handle this, every cold start would log out every user who tries to make a request.

The solution: the JWT payload includes a SHA-256 hash of the user's password (the `ph` claim). When the API receives a request from a user whose auth-token is valid but whose database rows don't exist, `selfHealFromJWT()` recreates the `users` and `profiles` rows from the JWT payload — including the password hash so login continues to work. The user never sees anything. The database repairs itself silently before the request continues.

### Rate limiting

`lib/rate-limiter.ts` is a token bucket in memory: one token per user per 3 seconds. It's per-Lambda-instance, which means it resets on cold starts and doesn't coordinate across concurrent Lambdas. That's acceptable for the current scale — it prevents accidental abuse and matches the Python SDK's built-in wait time. If we ever need coordinated rate limiting across Lambda instances, we'd move the bucket to Redis or an edge KV store.

### Security and validation

`lib/security.ts` validates and sanitizes everything that arrives at the API boundary. It detects QASM injection patterns (attempts to embed arbitrary instructions), enforces payload size limits (1MB for data, 100KB for QASM strings), applies HTML entity encoding to user strings before persisting them, and generates error responses that don't leak internal information (no stack traces, no filesystem paths, no variable names). All SQLite queries use prepared statements — there is no string interpolation anywhere in the database code.

### The ML engine

`lib/ml/cpp-ml-engine.ts` wraps a lightweight RL-inspired recommendation system. It vectorizes the features of a circuit (qubits, depth, gate count, algorithm, data complexity, the user's historical accuracy on similar circuits) into a normalized feature vector, looks up past executions with similar vectors, and suggests the optimal shots count, backend, and error mitigation strategy along with a confidence score.

On Vercel, the C++ binary path is bypassed and pure TypeScript heuristics are used. The C++ path is intended for self-hosted or on-premise deployments where compiling binaries is possible.

---

## 6. The C++ native layer

For large and massive datasets, the TypeScript circuit generator is too slow. The C++ layer in `scripts/` solves this.

```
lib/qasm-processor.ts
        │
        ├── Dataset is small or medium?
        │         │
        │         └──▶  Call buildCircuit() in TypeScript directly
        │                    [fast enough, no native overhead]
        │
        └── Dataset is large or massive, or useNative=true?
                  │
                  └──▶  Spawn .dist/generate_circuit binary
                              │
                              ├── Reads DataProfile JSON from stdin
                              ├── Builds optimized QASM 2.0
                              └── Writes result to stdout
                              [~5-10x faster for large datasets]
```

`generate_circuit.cpp` reads a DataProfile JSON from stdin and writes optimized QASM 2.0 to stdout. It is functionally equivalent to the TypeScript generator but significantly faster for large datasets because it avoids the JavaScript runtime overhead on numeric operations.

`transpile_circuit.cpp` applies gate-level optimizations to an existing QASM circuit: cancels adjacent inverse gates (two H gates in a row cancel each other, two X gates cancel, etc.), reduces the T-gate count (T gates are expensive on real quantum hardware), and remaps qubits to minimize decoherence errors. This is called via `/api/quantum/transpile`.

Both binaries communicate exclusively through stdin/stdout with JSON. There are no shared memory structures, no sockets, no file I/O. This keeps the interface clean and makes the fallback to TypeScript transparent — the caller doesn't need to know which path was used.

On Vercel, these binaries are not compiled (there's no build step for them in `vercel.json`). The platform detects their absence and automatically falls back to TypeScript. For self-hosted deployments:

```bash
mkdir .dist
g++ -O3 -std=c++17 -o .dist/generate_circuit scripts/generate_circuit.cpp
g++ -O3 -std=c++17 -o .dist/transpile_circuit scripts/transpile_circuit.cpp
```

---

## 7. Digital Twins

A Digital Twin in Planck-QSaaS is a named, persistent entity that represents a physical or computational system the user wants to model with quantum circuits over time. It could be `battery-optimizer-v2`, `supply-chain-model`, `protein-BRCA1`, or anything the user names it. The key distinction from a regular circuit run is the "over time" part.

Without Digital Twins, every execution is an isolated event. With Digital Twins, executions accumulate into a history that tells a story: how did the fidelity of this model change as I fed it different datasets? Which backend consistently gives the best results for this system? What does the qubit probability distribution look like when I use October data versus March data?

```
User creates a Digital Twin: "battery-optimizer"
        │
        ├── Run 1: January sensor data  →  fidelity 0.87, backend sim-v1
        ├── Run 2: February sensor data →  fidelity 0.91, backend sim-v2 (ML recommended switch)
        ├── Run 3: March sensor data    →  fidelity 0.89, backend sim-v2
        └── Run 4: April sensor data   →  fidelity 0.94, backend sim-v2
                                                │
                                                └── Dashboard shows the trend
                                                    Scenario Comparison: Run 1 vs Run 4
                                                    ML recommends: increase shots to 4096
```

Technically, each execution in the database carries an optional `digital_twin_id`. The `circuit_data` column of that execution stores the full insight JSON: probability distributions of each qubit state, gate count breakdown by type, T-gate fraction, decoherence risk estimate, and ML-generated recommendations for the next run. The dashboard groups executions by `digital_twin_id` and renders the trends across runs.

The `DigitalTwinModeContext` context manages globally whether twin mode is active. When off, executions still save to the database but skip the insight generation step — useful when the user just wants to run a quick circuit without the overhead of insight generation.

The `DigitalTwinSelector` component in the runner lets users create new twins on the fly or select existing ones. The `ScenarioComparison` component lets them put two runs of the same twin side by side to visually validate whether a parameter change improved the result.

---

## 8. Authentication

Authentication works exclusively with JWTs and cookies. No Supabase, no Auth0, no third-party auth dependency.

```
Sign-up flow:
─────────────────────────────────────────────────────────────
POST /api/auth/signup
  │
  ├── hashPassword(plain)  →  SHA-256 hex
  ├── Users.create(email, passwordHash)  →  userId
  ├── Profiles.create(userId, profileData)
  └── generateJWT(userId, email, {...profileData, ph: passwordHash})
            │
            └── Set-Cookie: auth-token (HttpOnly, Secure, 7-day)


Request flow (browser session):
─────────────────────────────────────────────────────────────
Any request to /api/*
  │
  ├── Read auth-token cookie
  ├── verifyJWT(token)  →  payload
  ├── Check if Users row exists for payload.userId
  │     ├── Exists?  →  continue
  │     └── Missing (cold start)?  →  selfHealFromJWT(payload)
  │               └── Recreate users + profiles rows from JWT payload
  └── authenticateRequest() returns { userId, authMethod: "cookie" }


Request flow (SDK / programmatic):
─────────────────────────────────────────────────────────────
Any request with x-api-key header
  │
  ├── validateApiKey(key)  →  regex: 64-char hex
  ├── ApiKeys.findByKey(key)  →  { userId }
  ├── ApiKeys.updateLastUsed(key)
  └── authenticateRequest() returns { userId, authMethod: "api-key" }
```

For unauthenticated users there is a "guest mode": they can see the landing page, the AI assistant, and marketing pages, but the `useIsGuest()` hook exposes their status to components so appropriate restrictions can be applied (the guest banner is shown, execution buttons are disabled, etc.).

---

## 9. The database

The platform uses SQLite through `better-sqlite3`. It is an embedded database — no separate server process, just a file on the filesystem.

```
users
  id │ email (UNIQUE) │ password_hash │ created_at │ updated_at
  └──────────────────────────────────────────────────────────────┐
                                                                 │ 1:1
profiles                                                         │
  id │ user_id (FK→users, CASCADE) │ full_name │ organization   ◄┘
   │   language │ theme_preference │ phone │ country │ occupation
   │   verified │ stay_logged_in
   │
   │ 1:N
   ▼
circuits
  id │ user_id (FK→users) │ name │ description │ circuit_data │ qasm │ backend
   │
   │ 1:N  (SET NULL on circuit delete — history survives)
   ▼
executions    ← the most important table
  id │ user_id (FK→users) │ circuit_id (FK→circuits, SET NULL)
  circuit_name │ algorithm │ execution_type │ backend │ status
  success_rate │ runtime_ms │ qubits_used │ shots │ error_mitigation
  backend_selected │ backend_reason │ result │ error │ completed_at
  circuit_data  ← full digital twin insight JSON blob lives here
   │
   └── Indexes: idx_executions_user_id, idx_executions_circuit_id

api_keys
  id │ user_id (FK→users, CASCADE) │ key (UNIQUE) │ name │ last_used │ created_at
     └── Index: idx_api_keys_key
```

A few design decisions worth understanding:

`executions.circuit_data` stores the entire digital twin insight as a JSON blob rather than normalizing it into a separate table. This avoids joins for the most frequent read pattern (loading the dashboard), keeps the schema simple, and makes it easy to version the insight format without migrations.

`executions.circuit_id` uses `SET NULL` on cascade instead of `CASCADE DELETE`. This means if a user deletes a circuit template, their execution history for that circuit still exists in the database — it just loses the link to the circuit. The execution record is valuable even without the source circuit.

All foreign keys are enforced at the database level (`PRAGMA foreign_keys = ON` in `lib/db/init.ts`). All queries are parameterized prepared statements — no string interpolation anywhere.

The `lib/db/init.ts` module creates all tables on startup if they don't exist, and runs lightweight auto-migrations to add missing columns. This is what lets the schema evolve without losing data even when the Vercel `/tmp` SQLite file survives between deploys in different states.

---

## 10. The Python SDK

The SDK (`sdk/python/`) is a Python package published to PyPI as `planck_sdk`. It has zero external dependencies — it uses only Python's standard library (`urllib`, `json`, `time`). This makes it installable in any environment without dependency conflicts, including Google Colab and minimal Docker containers.

```
sdk/python/
├── planck_sdk/
│   ├── __init__.py    exports PlanckUser — that's the entire public API
│   ├── client.py      PlanckUser class with run(), list_executions(), get_status()
│   ├── circuit.py     CircuitConfig dataclass (algorithm, shots, maxQubits, etc.)
│   ├── result.py      ExecutionResult dataclass (fidelity, counts, runtime_ms, etc.)
│   └── exceptions.py  PlanckError, APIError, AuthError, RateLimitError
└── examples/          Jupyter notebooks and example scripts
```

The SDK talks to `POST /api/quantum/simulate` with an `x-api-key` header. The platform validates the key against the `api_keys` table in SQLite via `lib/api-auth.ts`. The response is deserialized into an `ExecutionResult` object with typed fields. Between consecutive `run()` calls, the SDK automatically waits 3 seconds to respect the rate limit — the user doesn't have to think about it.

```
user code                 SDK                   Planck API
──────────────────────────────────────────────────────────────
user.run(data, "vqe")
      │
      ├── Validate payload size < 1MB
      ├── Build request body
      ├── POST /api/quantum/simulate
      │         x-api-key: <64-char-hex>
      │                   │
      │                   └── Full execution pipeline
      │                       (auth → validate → build circuit →
      │                        ML recommend → select backend →
      │                        simulate → save to DB)
      │                                │
      │◄── ExecutionResult JSON ───────┘
      │
      ├── Parse into ExecutionResult dataclass
      ├── Wait 3 seconds (rate limit compliance)
      └── Return result to caller
```

The error classes map directly to HTTP status codes: `AuthError` for 401/403, `RateLimitError` for 429 (includes the retry-after information), and `APIError` for everything else. This lets users write clean exception handling in their pipelines.

---

## 11. Real-time dashboard

The real-time update system is one of the more interesting technical decisions in the platform. It uses SSE (Server-Sent Events) rather than WebSockets, for a simple reason: SSE works over standard HTTP/1.1, is natively supported by browsers without any library, and is significantly easier to implement in a serverless environment where WebSocket connections can't persist across Lambda invocations.

```
Browser (dashboard)                    Vercel Lambda
─────────────────────────────────────────────────────────
Open EventSource to /api/quantum/stream?since=<timestamp>
        │
        │  HTTP connection kept open (up to 300s)
        │◄─────────────────────────────────────────────
        │             Poll SQLite every 3 seconds
        │             Find new executions since `since`
        │             Serialize as SSE events
        │◄── data: {"id":"...","algorithm":"vqe",...}
        │
        │  useLiveExecutions hook receives event
        │  Deduplicates by execution id
        │  Appends to local state
        │  Charts and table re-render
```

When the runner completes a manual execution (not via SDK), the `useLiveMode` hook calls `broadcastExecution()` to push the new row directly into the local state without waiting for the next SSE poll cycle. This makes the update feel instantaneous — the dashboard reacts before the SSE stream even picks it up.

The third piece is the `localStorage` cache. Every time the runner saves an execution, it also writes it to `planck_exec_cache` in localStorage (capped at 100 rows). When the dashboard loads, it merges three sources: the server database, the localStorage cache, and the live SSE stream. Server rows take priority. Cache rows fill the gaps when the database has been wiped. This is what makes the dashboard feel like it has persistent memory even though the underlying database is ephemeral.

---

## 12. The AI assistant

The platform includes an AI assistant (`components/quantum-assistant.tsx`) powered by OpenAI through the Vercel AI SDK. Responses stream token by token — the UI updates in real time as the model generates text, the same way ChatGPT works.

The assistant is specialized for the platform's domain. It can explain what VQE does and when to use it, suggest which algorithm fits a given optimization problem, interpret what a particular probability distribution from a run means, help the user understand why the fidelity is low, or walk them through setting up their first digital twin. The backend endpoint is `/api/quantum/assistant` and it uses the streaming response format from the Vercel AI SDK so the connection stays open until the model finishes generating.

The assistant is available on the landing page (for visitors who haven't registered yet) and inside the authenticated application. It does not have access to the user's execution history or database — it is a stateless Q&A assistant, not an agent.

---

## 13. Billing and plans

The billing page (`app/qsaas/billing/`) presents three tiers:

**Starter** at $29/month is aimed at individual researchers or companies doing their first evaluation. 1,000 circuit runs per month, up to 8 qubits, community support, basic analytics.

**Professional** at $99/month is for active research or engineering teams. 50,000 runs per month, up to 20 qubits, priority support, advanced analytics, custom circuit templates.

**Enterprise** at custom pricing is for large organizations with production workloads. Unlimited runs, up to 100 qubits, dedicated support, SSO, advanced security controls. The CTA for this plan opens a pre-filled email to `hello@plancktechnologies.xyz`.

Stripe is scaffolded in the code — the environment variables exist in `.env.local` (commented out) and the pricing components are in place. Connecting real checkout flows is the next step when the billing integration gets activated.

---

## 14. Deploying to Vercel

The `vercel.json` configuration handles the deployment setup. The build command is `pnpm run build`, the install command is `pnpm install`, and the framework is Next.js. The critical environment override is `DB_DIR=/tmp` — this tells SQLite where to create its file in the Vercel Lambda environment.

Automatic Git-triggered deployments are disabled (`"deploymentEnabled": false`). Deployments are done manually from the CLI:

```bash
vercel deploy --prod
```

This is intentional. We want explicit control over when code goes to production, not automatic deploys on every push to main. The production URL is `https://plancktechnologies.xyz`, aliased automatically by Vercel.

**The SQLite situation on Vercel.** This is worth understanding deeply because it affects how you think about the product's data model. Vercel's Lambda filesystem is ephemeral — the `/tmp` directory can be wiped between cold starts, between concurrent Lambda instances, or after any deploy. This means:

- Two concurrent users might be hitting different Lambda instances with different SQLite databases
- A cold start after 30 minutes of inactivity will have an empty database
- A new deploy always starts with a fresh database in every Lambda

The platform handles all three scenarios. New users who just signed up are protected by the JWT self-healing mechanism. Returning users' execution histories are protected by the localStorage cache. The 3-second SSE polling interval means the dashboard will pick up state from whichever Lambda instance happens to have data. The experience degrades gracefully rather than breaking.

When the platform grows to a scale where this becomes a real problem, migrating to a persistent database (Neon Postgres, PlanetScale, Turso) is the natural next step. The data access layer in `lib/db/client.ts` is the only thing that would need to change.

---

## 15. Local development

```bash
# Install dependencies
pnpm install

# Start the development server (Turbopack)
pnpm dev

# Run the test suite
pnpm test

# Build for production locally
pnpm build
```

The server starts at `http://localhost:3000`. The SQLite database is created automatically at `./.data/planck.db` on the first request (the `DB_DIR` environment variable controls this path, defaulting to `./.data` in the local `.env.local`).

The tests in `__tests__/` are lightweight integration tests that validate the execution result JSON shape and the localStorage cache merge behavior. They run without a server.

For the C++ native layer (optional — only needed for benchmarking large-dataset performance):

```bash
mkdir .dist
g++ -O3 -std=c++17 -o .dist/generate_circuit scripts/generate_circuit.cpp
g++ -O3 -std=c++17 -o .dist/transpile_circuit scripts/transpile_circuit.cpp
```

Without the compiled binaries, the platform automatically falls back to TypeScript for all circuit generation and transpilation. For day-to-day development this is completely fine.

---

## 16. Environment variables

| Variable | Required | Description |
|---|---|---|
| `DB_DIR` | Yes | Directory where SQLite creates its `.db` file. `./.data` locally, `/tmp` on Vercel. |
| `JWT_SECRET` | Yes | The key used to sign and verify JWTs. **In production this must be a cryptographically random string of at least 256 bits.** The value in `.env.local` is a placeholder for development only. |
| `NODE_ENV` | Yes | `development` or `production`. Affects error handling verbosity and logging behavior. |
| `OPENAI_API_KEY` | No | Required for the quantum assistant chat feature. Without it, the assistant endpoint returns an error. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | For Stripe billing integration. Currently commented out — not yet connected to real checkout flows. |
| `STRIPE_SECRET_KEY` | No | Same as above. |
| `VERCEL_OIDC_TOKEN` | No | Auto-injected by Vercel for OIDC identity verification. Never set this manually. |

---

## 17. Security

Security in the platform is layered. Each layer handles a specific class of threats.

**Authentication layer** — Every API request is authenticated before any business logic runs. Browser sessions use HttpOnly cookies with JWT tokens (no JavaScript access to the token). Programmatic access uses 64-character hex API keys validated by regex before any database lookup. Passwords are stored as SHA-256 hashes — never in plaintext, not even in the JWT (the `ph` claim is the hash, not the plain password).

**Input validation layer** — Everything that arrives at the API boundary passes through `lib/security.ts` before it is processed. QASM strings are scanned for injection patterns. Data payloads are checked for size (max 1MB) and structure. User strings are sanitized against XSS before being persisted. This happens at the API boundary, not scattered throughout the business logic.

**Database layer** — All SQLite queries use prepared statements with parameterized inputs. There is no string interpolation in any query in the codebase. Foreign key constraints are enforced at the database level. On user deletion, all their data cascades.

**Rate limiting layer** — The token bucket at `lib/rate-limiter.ts` prevents one user from flooding the system with requests. The Python SDK respects this automatically. The 1-request-per-3-seconds limit is enforced server-side regardless of what the client does.

**Error handling layer** — API errors never leak internal information to the client. `createSafeErrorResponse()` is used throughout the API layer to strip stack traces, filesystem paths, and internal variable names from error responses. Error messages returned to clients are generic and safe to expose publicly.

**Data deletion** — When a user deletes their execution history, the deletion is marked in localStorage (`planck_exec_deleted_ids` and `planck_exec_cleared_before`) so that deleted rows don't "come back" from the localStorage cache even if the server still has them in a warm Lambda instance. When a user deletes their account, everything cascades from the `users` table down through all foreign key relationships.

---

*Planck Technologies — hello@plancktechnologies.xyz*
*© 2024–2026 Planck Technologies. All rights reserved.*
