# Planck-QSaaS — Internal Repository Documentation

> **Private — Planck Technologies**
> Hybrid Quantum Digital Twins · SaaS Platform · Internal Monorepo

<img width="2669" height="585" alt="Planck QSaaS Banner" src="https://github.com/user-attachments/assets/beea1cff-1c81-481a-a95e-e47b2f834d85" />

---

## Table of Contents

1. [What is Planck-QSaaS?](#1-what-is-planck-qsaas)
2. [Architecture at a Glance](#2-architecture-at-a-glance)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Authentication & Authorization Flow](#5-authentication--authorization-flow)
6. [Database Architecture](#6-database-architecture)
7. [Quantum Execution Pipeline](#7-quantum-execution-pipeline)
8. [Digital Twins System](#8-digital-twins-system)
9. [ML & C++ Native Layer](#9-ml--c-native-layer)
10. [API Reference](#10-api-reference)
11. [Python SDK](#11-python-sdk)
12. [Billing & Pricing Plans](#12-billing--pricing-plans)
13. [Deployment (Vercel)](#13-deployment-vercel)
14. [Local Development](#14-local-development)
15. [Environment Variables](#15-environment-variables)
16. [Subsystem Dependencies Map](#16-subsystem-dependencies-map)
17. [Security Model](#17-security-model)

---

## 1. What is Planck-QSaaS?

Planck-QSaaS is the **production SaaS platform** for Planck Technologies. It exposes quantum computing infrastructure as an easy-to-use web application and REST API, removing the need for researchers, engineers and companies to manage their own quantum hardware or simulators.

**Core value propositions:**

- **Hybrid Digital Twins** — every circuit execution optionally generates a digital twin insight: a structured JSON blob capturing fidelity, probability distributions, gate statistics, and recommendations. Users can create named digital twins (e.g., `battery-optimizer-v2`) and track their performance over time across different datasets.
- **No-code circuit generation** — upload any dataset (CSV, JSON, numeric arrays). The platform auto-parses it, derives a circuit topology, and runs the appropriate quantum algorithm. No QASM knowledge required.
- **Parametric QASM 2.0** — all circuits are generated deterministically from the uploaded data profile. Same data → same circuit. No randomness, no hardcoded gate sequences.
- **Adaptive backend selection** — the system selects the best execution backend (simulator tier) based on the circuit size, user quota, latency policy, and available capacity. Policies are auditable.
- **Real-time dashboard** — Server-Sent Events (SSE) stream new execution rows to the dashboard as they complete. Charts update live.
- **Python SDK** — zero-dependency client library (`planck_sdk`) for embedding quantum workflows in Python notebooks, scripts, and pipelines. Published to PyPI.
- **GDPR-ready** — users can delete all their execution history and account data from the settings page. Soft-delete semantics propagate to the localStorage cache.

**Contact:** hello@plancktechnologies.xyz

---

## 2. Architecture at a Glance

```
┌────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 App (Vercel)                     │
│                                                                    │
│  ┌─────────────┐   ┌──────────────────┐   ┌────────────────────┐  │
│  │  Landing /  │   │  Auth pages      │   │  QSaaS app         │  │
│  │  Marketing  │   │  /auth/login     │   │  /qsaas/...        │  │
│  │  app/page   │   │  /auth/sign-up   │   │  runner, dashboard │  │
│  └─────────────┘   │  /auth/callback  │   │  billing, settings │  │
│                    └──────────────────┘   └─────────┬──────────┘  │
│                                                     │              │
│  ┌──────────────────────────────────────────────────▼───────────┐ │
│  │                    API Routes (/api/...)                      │ │
│  │   /api/quantum/simulate   /api/quantum/stream (SSE)          │ │
│  │   /api/quantum/generate-circuit  /api/quantum/transpile      │ │
│  │   /api/quantum/visualize  /api/quantum/digital-twin          │ │
│  │   /api/quantum/ml-recommend  /api/quantum/assistant          │ │
│  │   /api/auth/signup  /api/user/...  /api/dashboard/data       │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│                             │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐ │
│  │                     lib/ (Core Logic)                        │ │
│  │  circuit-builder  circuit-utils  backend-policy  security    │ │
│  │  auth-utils  api-auth  rate-limiter  qasm-processor          │ │
│  │  db/init  db/client  ml/cpp-ml-engine  constants             │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│                             │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐ │
│  │                  SQLite (better-sqlite3)                      │ │
│  │            /tmp/planck.db  (ephemeral on Vercel)             │ │
│  │    users · profiles · circuits · executions · api_keys       │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘

         ┌──────────────────────────────────────────────┐
         │     External integrations (planned/partial)  │
         │  C++ native binaries (generate_circuit.cpp)  │
         │  Python SDK (planck_sdk on PyPI)              │
         │  Stripe (billing, not yet wired)              │
         │  OpenAI (quantum assistant via ai SDK)        │
         └──────────────────────────────────────────────┘
```

---

## 3. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| Framework | **Next.js** App Router | 16.1.6 |
| Runtime | **React** | 19.2.1 |
| Language | **TypeScript** | strict mode |
| Database | **SQLite** via `better-sqlite3` | ephemeral on Vercel `/tmp` |
| Styling | **Tailwind CSS** + `shadcn/ui` | Radix UI primitives |
| Auth | **JWT** (custom, `jose`) + cookie | 7-day expiry, self-healing |
| AI | **Vercel AI SDK** + OpenAI | quantum circuit assistant |
| Charts | **Chart.js** + `react-chartjs-2` | execution dashboards |
| Animations | **Lottie**, Tailwind animations | landing page |
| Package manager | **pnpm** | |
| Deployment | **Vercel** | `vercel.json` configured |
| Testing | **Vitest** | `__tests__/` directory |
| Native layer | **C++17** (g++ / clang++) | circuit generation + transpilation |
| Python SDK | **planck_sdk** (PyPI) | zero-dependency |

---

## 4. Repository Structure

```
Repo/
├── app/                    # Next.js App Router pages and API routes
│   ├── page.tsx            # Public landing page (marketing)
│   ├── layout.tsx          # Root layout (providers, fonts, analytics)
│   ├── globals.css         # Global CSS reset + Tailwind base
│   ├── auth/               # Unauthenticated auth pages
│   │   ├── login/          # Login page
│   │   ├── sign-up/        # Registration with phone/email
│   │   └── oauth-callback/ # OAuth redirect handler
│   ├── qsaas/              # Protected SaaS application shell
│   │   ├── layout.tsx      # Sidebar + mobile nav layout
│   │   ├── dashboard/      # Digital twin live dashboard
│   │   ├── runner/         # Circuit runner (upload → run → results)
│   │   ├── billing/        # Subscription plans UI
│   │   ├── settings/       # Account, API keys, preferences
│   │   └── templates/      # Algorithm template browser
│   ├── api/                # Next.js API Route handlers
│   │   ├── quantum/        # All quantum operations (see §10)
│   │   ├── auth/           # Signup, logout
│   │   ├── dashboard/      # Dashboard stats endpoint
│   │   ├── user/           # Profile CRUD
│   │   └── request-utils/  # JWT/guest extraction
│   ├── privacy/            # Privacy policy page
│   └── terms/              # Terms of service page
├── components/             # Shared React components
│   ├── ui/                 # shadcn/ui primitives (Button, Card, Dialog…)
│   ├── layout/             # App shell (sidebar, mobile nav, protected route)
│   ├── runner/             # Circuit runner panels (uploader, results, DT…)
│   ├── dashboard/          # Live charts + digital twin dashboard
│   └── (root)              # Landing page components (hero, pricing, FAQ…)
├── contexts/               # React Context providers
├── hooks/                  # Custom React hooks
├── lib/                    # Server-side core logic (never imported by client)
│   ├── db/                 # SQLite schema, ORM-style client
│   ├── ml/                 # C++ ML engine wrapper
│   ├── types/              # Shared TypeScript interfaces
│   └── utils/              # Misc helpers
├── scripts/                # C++ source files (native layer)
│   ├── generate_circuit.cpp
│   └── transpile_circuit.cpp
├── sdk/python/             # Python client SDK (planck_sdk)
├── styles/                 # Additional CSS (globals mirror)
├── public/                 # Static assets (images, icons)
├── __tests__/              # Vitest integration tests
├── next.config.mjs         # Next.js config (Turbopack, unoptimized images)
├── vercel.json             # Vercel deployment config (DB_DIR=/tmp)
├── tsconfig.json           # TypeScript config (strict, path aliases)
└── vitest.config.ts        # Vitest config
```

### 4.1 `app/` — Next.js App Router

The app directory follows the Next.js App Router convention. Every folder with a `page.tsx` is a route. Layouts at each level wrap their children.

#### `app/page.tsx` — Landing Page

The public marketing page. Renders hero, features, pricing (`components/pricing-section.tsx`), FAQ, and footer. Forces light theme on mount. No auth required.

**Dependencies:** `components/pricing-section`, `components/faq-section`, `components/hero-background`, `components/footer`, `contexts/language-context`

#### `app/auth/` — Authentication Pages

| Route | Purpose |
|---|---|
| `/auth/login` | Email + password login form. Sets `auth-token` JWT cookie. |
| `/auth/sign-up` | Multi-step registration: email → password → phone → OTP. Calls `POST /api/auth/signup`. |
| `/auth/oauth-callback` | Handles OAuth redirect and mints a session cookie. |

**Key dependency:** `lib/auth-utils.ts` for JWT generation, `lib/db/client.ts` for user creation.

#### `app/qsaas/` — Protected Application Shell

The main SaaS product. The `layout.tsx` wraps everything in `<MainLayout>` which renders the sidebar (desktop) and bottom navigation (mobile). Access is guarded by `components/layout/protected-route.tsx`.

##### `app/qsaas/runner/page.tsx` — Circuit Runner

The most complex page in the application. Full workflow:

1. **Upload** a dataset (CSV or JSON via `<DatabaseUploader>`)
2. **Auto-parse** — `<AutoParser>` calls `analyzeInputData()` from `lib/circuit-builder.ts` to derive a `DataProfile` (qubits, angles, depth)
3. **Configure** — choose algorithm (`<CircuitSettings>`), shots, error mitigation, backend hint (`<ExecutionSettings>`)
4. **Select digital twin** — optionally associate the run with a named digital twin (`<DigitalTwinSelector>`)
5. **Run** — `POST /api/quantum/simulate`; response includes fidelity, counts, success rate, runtime
6. **View results** — `<CircuitResults>` shows raw counts; `<DigitalTwinPanel>` shows the DT insight; `<ScenarioComparison>` compares multiple runs side by side
7. **Live dashboard** — `<DigitalTwinDashboard>` at the bottom of the runner shows SSE-streamed execution history in real time

**Key dependencies:** `lib/circuit-builder`, `lib/backend-selector`, `hooks/use-live-executions`, `hooks/use-live-mode`, `contexts/digital-twin-mode-context`, `contexts/synthetic-mode-context`

##### `app/qsaas/dashboard/page.tsx` — Digital Twin Dashboard

Four summary stat cards (total runs, avg success rate, avg runtime, avg qubits) plus one `<DigitalTwinDashboard>` tab per digital twin.

Live data flows:
- On mount: fetches `/api/dashboard/data` for aggregate stats and `/api/quantum/executions` for the full history
- SSE via `useLiveExecutions` appends new rows in real time
- `localStorage` cache `planck_exec_cache` (up to 100 rows) survives Vercel cold-start DB wipes

##### `app/qsaas/billing/page.tsx` — Billing

Static plan comparison: Starter ($29/mo), Professional ($99/mo), Enterprise (custom). Stripe scaffolded but not yet wired.

##### `app/qsaas/settings/page.tsx` — Settings

- Update display name, organization, country, occupation
- Generate / revoke API keys (v0.9 format: 64-char hex)
- Toggle dark/light theme, language, digital twin mode
- Delete individual execution rows or clear all history (propagates to `localStorage` cache)
- Delete account (cascades to all user data in SQLite)

##### `app/qsaas/templates/` — Algorithm Templates

Browses `QUANTUM_TEMPLATES` from `lib/constants.ts`. Clicking "Use Template" routes to the runner with that algorithm pre-selected.

---

### 4.2 `components/`

#### `components/ui/` — Primitive UI Library

`shadcn/ui` components built on Radix UI. Button, Card, Dialog, Select, Tabs, Toast, Tooltip, and ~40 more primitives. Never edit directly.

#### `components/layout/`

| File | Purpose |
|---|---|
| `main-layout.tsx` | Top-level authenticated shell. Renders Sidebar (desktop) / MobileBottomNav (mobile). |
| `sidebar.tsx` | Navigation links, user info, logout button. Responsive collapsible. |
| `mobile-bottom-nav.tsx` | 5-icon bottom tab bar for mobile viewports. |
| `protected-route.tsx` | Checks `auth-token` cookie via `GET /api/request-utils`. Redirects to login if absent/expired. |
| `mode-status-banner.tsx` | Top-of-screen banner: Live / Synthetic / Guest mode indicator. |

#### `components/runner/`

| File | Purpose |
|---|---|
| `database-uploader.tsx` | Drag-and-drop / file picker for CSV and JSON uploads. Validates size (<1MB) and format. |
| `autoparser.tsx` | Calls `analyzeInputData()`. Displays the derived DataProfile (qubits, features, data scale, suggested algorithm). |
| `circuit-settings.tsx` | Algorithm selector, custom circuit name. |
| `execution-settings.tsx` | Shots slider, error mitigation picker, backend hint selector, DT mode toggle. |
| `circuit-results.tsx` | Raw measurement counts as a bar chart + fidelity/success badges. |
| `digital-twin-panel.tsx` | Displays the digital twin insight: probability distributions, gate analysis, recommendations. |
| `digital-twin-selector.tsx` | Create/select a named digital twin. Stored per-user. |
| `expected-results.tsx` | Optional: user defines expected qubit probabilities to compare against actual counts. |
| `results-panel.tsx` | Aggregated view combining circuit results + DT insight. |
| `scenario-comparison.tsx` | Side-by-side comparison of past runs for the same digital twin. |
| `synthetic-data-runner.tsx` | Synthetic mode: generates datasets internally (no file upload needed) and runs the full pipeline. |

#### `components/dashboard/`

| File | Purpose |
|---|---|
| `digital-twin-dashboard.tsx` | Live execution dashboard for one digital twin. Three Chart.js charts (latency trend, backend distribution, success rate) + runs table. Subscribes to SSE via `useLiveExecutions`. |
| `execution-charts.tsx` | Individual chart components. Accept `ExecutionRow[]` as props. |

#### Root-level components (landing page)

| File | Purpose |
|---|---|
| `hero-background.tsx` / `hero-animation.tsx` | Canvas/CSS animated quantum-inspired background. |
| `interactive-qubit.tsx` | Animated Bloch-sphere-style qubit graphic. |
| `pricing-section.tsx` | Three pricing cards with feature lists and CTA buttons. |
| `faq-section.tsx` | Accordion FAQ powered by `@radix-ui/react-accordion`. |
| `quantum-assistant.tsx` | Floating AI chat widget (Vercel AI SDK + OpenAI). |
| `quantum-loading-screen.tsx` | Full-screen loading animation during initial app hydration. |
| `guest-banner.tsx` | Top banner for unauthenticated users. Exposes `useIsGuest()` hook. |
| `theme-provider.tsx` | `next-themes` wrapper. |
| `language-selector.tsx` | Dropdown to switch app language. |
| `page-header.tsx` | Reusable page title + description header inside the QSaaS app. |
| `error-boundary.tsx` | React error boundary wrapping critical sections. |

---

### 4.3 `contexts/`

React Context providers. All persist state to `localStorage` where relevant.

| File | Key State | Where Used |
|---|---|---|
| `digital-twin-mode-context.tsx` | `dtMode: boolean` — toggles DT insight generation on/off | Runner, Settings |
| `synthetic-mode-context.tsx` | `syntheticMode: boolean` — real-data vs synthetic-data execution mode | Runner |
| `language-context.tsx` | `language`, `t()` translation function | Landing, Auth, Runner |
| `ui-preferences-context.tsx` | `compactMode`, `showAdvanced`, etc. — persisted UI preferences | Settings, Runner |

---

### 4.4 `hooks/`

| File | Purpose | Dependencies |
|---|---|---|
| `use-live-executions.ts` | Opens an `EventSource` to `/api/quantum/stream`. Appends new `ExecutionRow` objects as they arrive via SSE. Deduplicates by `id`. | `lib/types/` |
| `use-live-mode.ts` | Manages live mode state (SSE connected vs. disconnected). Exposes `broadcastExecution()` to manually push a row after a manual simulation run. | `use-live-executions.ts` |
| `use-mobile.ts` | Returns `true` if `window.innerWidth < 768px`. Used by `main-layout.tsx`. | — |

---

### 4.5 `lib/` — Server-Side Core Logic

Everything here runs **server-side only** (API routes or Server Components). Never import from `lib/` in client components.

#### `lib/db/`

| File | Responsibility |
|---|---|
| `init.ts` | Creates all SQLite tables on first request. Runs auto-migrations to add missing columns. Sets `PRAGMA foreign_keys = ON`. |
| `client.ts` | ORM-style typed wrappers: `Users`, `Profiles`, `Circuits`, `Executions`, `ApiKeys`. All queries are parameterised (no string interpolation). |

**Schema:** `users` → `profiles` (1:1) → `circuits` (1:N) → `executions` (1:N) → `api_keys` (1:N)

#### `lib/auth-utils.ts`

JWT generation and verification using `jose`.

Key functions:
- `generateJWT(userId, email, profileData)` → 7-day JWT
- `verifyJWT(token)` → decoded payload or throws
- `hashPassword(plain)` → SHA-256 hex
- `selfHealFromJWT(payload)` → recreates `users`/`profiles` rows from JWT payload (critical for Vercel cold-start survivability)

#### `lib/api-auth.ts`

`authenticateRequest(request)` resolves a `userId` from:
1. `x-api-key` header → `ApiKeys.findByKey()` in SQLite
2. `auth-token` cookie → `verifyJWT()`

Returns `{ userId, authMethod }` or throws 401.

#### `lib/circuit-builder.ts`

**Core circuit intelligence.** Converts raw data into a fully parametric QASM 2.0 circuit.

Public API:
- `analyzeInputData(data, opts?)` → `DataProfile` (qubits, depth, gateCount, angles, featureCount, dataScale)
- `buildCircuit(algorithm, profile, opts?)` → `BuiltCircuit` (qasm string + metadata)

Data-scale tiers:
- `small` (<1K): full feature embedding, standard textbook ansatz
- `medium` (<50K): sampled statistics, compact entanglement layers
- `large` (<10M): log-compressed qubits, amplitude encoding
- `massive` (≥10M): maximum qubit compression, repeated amplitude layers

Supported algorithms: `vqe`, `qaoa`, `grover`, `shor`, `bell`, `qft`

#### `lib/circuit-utils.ts`

Utilities derived from a `DataProfile`:
- `extractQubits(profile)` → adaptive qubit count
- `calculateAdaptiveShots(profile)` → base 512 + bonuses for qubits/depth/gates
- `selectErrorMitigation(profile)` → `none` | `readout` | `zne` | `pec`

#### `lib/backend-policy.ts`

Backend selection with three auditable policies:
- `latency_first` (default): prioritises lowest latency backend
- `cost_first`: prioritises cheapest backend with sufficient capacity
- `capacity_first`: prioritises backend with most available qubit headroom

Returns a `BackendDecision` with `backend`, `reason`, `policy` — fully auditable.

#### `lib/backend-selector.ts`

Low-level backend primitives:
- `selectOptimalBackend(circuit, hint?)` → backend name string
- `calculateFidelity(circuit, backend)` → estimated fidelity [0,1]
- `estimateRuntime(circuit, backend, shots)` → runtime in ms

#### `lib/qasm-processor.ts`

Facade coordinating circuit generation:
1. For small/medium data: calls TypeScript `buildCircuit()` directly
2. For large/massive data or `useNative=true`: spawns `generate_circuit` C++ binary via `child_process.spawn`
3. Transpilation: routes through `transpile_circuit` C++ binary or TS fallback

#### `lib/security.ts`

All input validation and sanitization:
- `validateApiKey(key)` — regex check (v0.9: 64-char hex)
- `validateQASM(qasm)` — injection pattern detection, size check (10B–100KB)
- `validateInputData(data)` — structure check, max 1MB, max 10K elements
- `sanitizeString(s)` — HTML entity encoding + SQL/XSS pattern removal
- `createSafeErrorResponse(err)` — strips stack traces and internal paths
- `validateRequestHeaders(req)` — CORS and expected header validation

#### `lib/rate-limiter.ts`

Token-bucket rate limiter: 1 token per 3 seconds per user. In-memory (resets on cold start). Returns HTTP 429 on excess.

#### `lib/constants.ts`

`QUANTUM_TEMPLATES` array (Bell, Grover, Shor, VQE, QAOA, QFT) with metadata, plus pricing plan definitions and algorithm category mappings.

#### `lib/ml/cpp-ml-engine.ts`

TypeScript wrapper around the C++ reinforcement learning engine:
- `vectorizeFeatures(CircuitFeatures)` → normalized feature vector (TS fallback on Vercel)
- `recommendParams(features, history)` → `MLRecommendation` (shots, backend, mitigation + confidence)
- `recordExecution(result)` → appends to mega-table for future learning

---

### 4.6 `scripts/` — C++ Native Binaries

High-performance native layer. Invoked server-side via `child_process.spawn`.

| File | Purpose | Invoked by |
|---|---|---|
| `generate_circuit.cpp` | Reads a `DataProfile` JSON from stdin, emits optimised QASM 2.0 to stdout. ~10× faster than TypeScript for large/massive datasets. | `lib/qasm-processor.ts` |
| `transpile_circuit.cpp` | Gate-level circuit optimisation: cancels adjacent inverse gates, reduces T-gate count, remaps qubits. | `app/api/quantum/transpile/route.ts` |

**Compile:**
```bash
mkdir .dist
g++ -O3 -std=c++17 -o .dist/generate_circuit scripts/generate_circuit.cpp
g++ -O3 -std=c++17 -o .dist/transpile_circuit scripts/transpile_circuit.cpp
```

> On Vercel these binaries are not compiled. All paths fall back to TypeScript automatically.

---

### 4.7 `sdk/python/` — Python Client Library

Zero-dependency Python package. Uses only the standard library (`urllib`, `json`, `time`).

```
sdk/python/
├── planck_sdk/
│   ├── __init__.py      # Package entry-point, exposes PlanckUser
│   ├── client.py        # PlanckUser class: run(), list_executions(), get_status()
│   ├── circuit.py       # CircuitConfig dataclass
│   ├── result.py        # ExecutionResult dataclass
│   └── exceptions.py    # PlanckError, APIError, AuthError, RateLimitError
├── examples/            # Jupyter notebooks + Python scripts
├── setup.py             # PyPI packaging
└── README.md            # SDK-specific documentation
```

**SDK ↔ platform dependencies:**
- `PlanckUser.run()` → `POST /api/quantum/simulate` (x-api-key auth)
- `PlanckUser.list_executions()` → `GET /api/quantum/executions`
- API keys managed in `lib/db/client.ts → ApiKeys` table
- Auth validated in `lib/api-auth.ts`

---

### 4.8 `styles/` & `public/`

- `styles/globals.css` — Tailwind base + CSS variable definitions for the design system (light/dark tokens)
- `public/images/` — logos, algorithm icons, design-mode assets. All images served statically (`unoptimized: true`)

---

### 4.9 `__tests__/`

| File | What it tests |
|---|---|
| `exec-cache-sdk-live.test.ts` | Integration: full SDK live execution flow + localStorage cache merge |
| `execution-json-shape.test.ts` | Unit: JSON shape returned by `/api/quantum/simulate` matches the `ExecutionResult` contract |

```bash
pnpm test
```

---

## 5. Authentication & Authorization Flow

```
Browser                        Server (API Routes)             SQLite
  │                                  │                            │
  │── POST /api/auth/signup ─────────▶                            │
  │   { email, password, profile }   │── Users.create() ─────────▶
  │                                  │── Profiles.create() ───────▶
  │                                  │── generateJWT() ──────────┐│
  │◀── Set-Cookie: auth-token ───────│◀──────────────────────────┘│
  │                                  │                            │
  │── Any authenticated request ─────▶                            │
  │   Cookie: auth-token             │── verifyJWT() ─────────────│
  │                                  │── selfHealFromJWT() ───────▶ (recreates rows on cold start)
  │                                  │                            │
  │── x-api-key: <64-char hex> ──────▶                            │
  │   (SDK / programmatic access)    │── ApiKeys.findByKey() ─────▶
```

**Cold-start self-healing:** SQLite on Vercel lives in `/tmp` and is wiped on every cold start. `selfHealFromJWT()` in `lib/auth-utils.ts` re-creates `users` and `profiles` rows from the JWT payload (`ph` claim = SHA-256 password hash), keeping users logged in across deploys.

---

## 6. Database Architecture

**Tables:**

```sql
users          id | email (UNIQUE) | password_hash | created_at | updated_at
profiles       id | user_id (FK→users) | full_name | organization | theme_preference
               | language | phone | country | occupation | verified | stay_logged_in
circuits       id | user_id (FK→users) | name | description | circuit_data | qasm | backend
executions     id | user_id (FK→users) | circuit_id (FK→circuits, SET NULL on delete)
               | circuit_name | algorithm | execution_type | backend | status
               | success_rate | runtime_ms | qubits_used | shots | error_mitigation
               | backend_selected | backend_reason | result | error | completed_at
               | circuit_data (JSON: digital twin insights)
api_keys       id | user_id (FK→users, CASCADE) | key (UNIQUE) | name | last_used | created_at
```

**Key design decisions:**
- `executions.circuit_data` stores the full digital twin JSON blob, avoiding a separate `digital_twin_insights` table.
- All `api_keys` cascade-delete when the user is deleted.
- `executions.circuit_id` uses `SET NULL` (not CASCADE) so execution history is preserved even if a circuit template is deleted.
- The DB is intentionally SQLite for simplicity. `lib/db/init.ts` handles schema drift on Vercel cold starts.

---

## 7. Quantum Execution Pipeline

```
1. User uploads dataset (CSV/JSON) in the Runner
        ↓
2. AutoParser calls analyzeInputData() [lib/circuit-builder.ts]
   → Derives: qubits, depth, angles, dataScale, featureCount
        ↓
3. User selects algorithm, shots, error mitigation, backend hint
        ↓
4. POST /api/quantum/simulate
        ↓
5. authenticateRequest() [lib/api-auth.ts]
        ↓
6. validateInputData() + validateQASM() [lib/security.ts]
        ↓
7. Rate-limit check [lib/rate-limiter.ts] (1 req / 3s per user)
        ↓
8. buildCircuit(algorithm, dataProfile) [lib/circuit-builder.ts]
   → For large/massive data: spawns generate_circuit C++ binary
        ↓
9. CppMLEngine.recommendParams() [lib/ml/cpp-ml-engine.ts]
   → Suggests optimal shots, backend, error mitigation
        ↓
10. selectOptimalBackend() [lib/backend-policy.ts]
    → Applies latency_first / cost_first / capacity_first policy
        ↓
11. Execute circuit simulation (TypeScript simulator)
    → Returns: counts, success_rate, runtime_ms, fidelity
        ↓
12. (If dtMode=true) POST /api/quantum/digital-twin
    → Generates digital twin insight JSON
        ↓
13. Executions.create() [lib/db/client.ts]
    → Persists full execution record to SQLite
        ↓
14. CppMLEngine.recordExecution() — logs to ML mega-table
        ↓
15. Response returned to client
    → Runner updates UI, writes to localStorage cache
    → SSE stream notifies dashboard of new row
```

---

## 8. Digital Twins System

A **digital twin** is a named, persistent representation of a physical or computational system modelled with quantum circuits (e.g., `battery-optimizer`, `supply-chain-v2`, `protein-fold-model`).

Each execution can be tagged with a digital twin ID. The platform tracks:
- **Historical performance** across datasets (fidelity trend, success rate over time)
- **Probability distributions** from measurement outcomes
- **Gate analysis** (gate counts, circuit depth, T-gate fraction)
- **ML Recommendations** for the next run

Digital twins appear as tabs in the dashboard. The `circuit_data` JSON column in `executions` stores the per-run twin insight.

**Key files:**
- `components/runner/digital-twin-selector.tsx` — create/select twin in the runner
- `components/runner/digital-twin-panel.tsx` — render twin insight after a run
- `components/dashboard/digital-twin-dashboard.tsx` — historical view with live charts
- `app/api/quantum/digital-twin/route.ts` — server-side insight generation
- `contexts/digital-twin-mode-context.tsx` — toggle twin mode globally

---

## 9. ML & C++ Native Layer

### ML Recommendation System

`lib/ml/cpp-ml-engine.ts` implements a lightweight RL-inspired recommendation system:

1. **Feature vectorization**: converts `CircuitFeatures` (qubits, depth, gate count, algorithm, data complexity, user historical accuracy) into a normalized feature vector
2. **Recommendation**: looks up past executions with similar feature vectors, suggests shots/backend/mitigation with a confidence score
3. **Recording**: every completed execution is logged, improving future recommendations

On Vercel the C++ binary path is bypassed — pure TypeScript heuristics are used. The C++ path is intended for self-hosted deployments.

### C++ Circuit Generator (`scripts/generate_circuit.cpp`)

Used for large (>50K samples) and massive (>10M samples) datasets. Reads a `DataProfile` JSON from stdin and outputs optimised QASM 2.0 to stdout. Compile with:

```bash
g++ -O3 -std=c++17 -o .dist/generate_circuit scripts/generate_circuit.cpp
```

### C++ Transpiler (`scripts/transpile_circuit.cpp`)

Gate-level circuit optimisation: cancels adjacent inverse gates, reduces T-gate count, remaps qubits. Called via `/api/quantum/transpile`.

---

## 10. API Reference

All routes under `app/api/`. Auth via `x-api-key` header or `auth-token` cookie.

### Quantum Operations

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/quantum/simulate` | Main execution endpoint. Returns full `ExecutionResult`. |
| `POST` | `/api/quantum/generate-circuit` | Generate QASM from a `DataProfile`. |
| `POST` | `/api/quantum/transpile` | Gate-optimise a QASM string (C++ binary or TS fallback). |
| `POST` | `/api/quantum/visualize` | Convert QASM to an SVG circuit diagram. |
| `POST` | `/api/quantum/ml-recommend` | ML-based shot/backend/mitigation recommendations. |
| `POST` | `/api/quantum/digital-twin` | Generate a digital twin insight JSON for a completed execution. |
| `POST` | `/api/quantum/assistant` | Streaming AI assistant (OpenAI via Vercel AI SDK). |
| `GET` | `/api/quantum/executions` | List user's execution history (paginated). |
| `GET` | `/api/quantum/stream` | SSE endpoint. Streams new rows since `?since=<ISO-timestamp>`. 300s timeout. |
| `GET` | `/api/quantum/health` | Health check. Returns `{ status: "ok", db: "ok" }`. |

### Authentication

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create user + profile. Sets `auth-token` cookie. |
| `POST` | `/api/auth/logout` | Clears `auth-token` and `planck_guest` cookies. |

### User & Dashboard

| Method | Route | Description |
|---|---|---|
| `GET/PUT` | `/api/user/profile` | Read or update the authenticated user's profile. |
| `POST` | `/api/user/api-keys` | Generate a new API key. |
| `DELETE` | `/api/user/api-keys` | Revoke an API key. |
| `GET` | `/api/dashboard/data` | Aggregate execution stats for `?range=24h|7d|30d`. |
| `GET` | `/api/request-utils` | Validate current session. Returns `{ userId, isGuest }`. |

---

## 11. Python SDK

```bash
pip install planck_sdk
```

```python
from planck_sdk import PlanckUser

user = PlanckUser(api_key="<64-char-hex>", base_url="https://plancktechnologies.xyz")

# Run with data
result = user.run(data=[1.0, 2.5, 0.3], algorithm="qaoa", shots=1024)
print(result.fidelity)       # float [0,1]
print(result.success_rate)   # float [0,1]
print(result.counts)         # {"00": 512, "11": 512}
print(result.runtime_ms)     # int
print(result.backend)        # str
print(result.digital_twin)   # dict | None

# List history
executions = user.list_executions(limit=50)
```

**Error classes:** `PlanckError` (base), `APIError`, `AuthError` (invalid key), `RateLimitError` (429).

The SDK automatically waits 3 seconds between consecutive `run()` calls to comply with the platform rate limit.

---

## 12. Billing & Pricing Plans

| Plan | Price | Runs/month | Max qubits |
|---|---|---|---|
| Starter | $29/mo | 1,000 | 8 |
| Professional | $99/mo | 50,000 | 20 |
| Enterprise | Custom | Unlimited | 100 |

Stripe is scaffolded (`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`) but not yet connected to real checkout flows. Enterprise plan inquiries go to `hello@plancktechnologies.xyz`.

---

## 13. Deployment (Vercel)

`vercel.json`:
```json
{
  "buildCommand": "pnpm run build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "env": { "NEXT_TELEMETRY_DISABLED": "1", "DB_DIR": "/tmp" }
}
```

**Key notes:**
- `DB_DIR=/tmp` → SQLite is ephemeral. Self-healing JWT keeps users logged in across cold starts.
- `git.deploymentEnabled: false` → manual deploys only via `vercel deploy`.
- Images are `unoptimized: true` to avoid Vercel Image Optimization quota.
- C++ binaries are not compiled on Vercel — all paths fall back to TypeScript automatically.

**Production URL:** `https://plancktechnologies.xyz`

---

## 14. Local Development

```bash
# Install dependencies
pnpm install

# Start dev server (Turbopack)
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# (Optional) Compile C++ binaries
mkdir .dist
g++ -O3 -std=c++17 -o .dist/generate_circuit scripts/generate_circuit.cpp
g++ -O3 -std=c++17 -o .dist/transpile_circuit scripts/transpile_circuit.cpp
```

Default dev server: `http://localhost:3000`

The SQLite database is created automatically at `./.data/planck.db` on first request (controlled by `DB_DIR`).

---

## 15. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_DIR` | Yes | SQLite directory. `./.data` locally, `/tmp` on Vercel. |
| `JWT_SECRET` | Yes | JWT signing secret. **Must be changed in production.** |
| `NODE_ENV` | Yes | `development` or `production`. |
| `OPENAI_API_KEY` | No | Powers the quantum assistant chat feature. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Stripe publishable key (billing, not yet active). |
| `STRIPE_SECRET_KEY` | No | Stripe secret key (billing, not yet active). |
| `VERCEL_OIDC_TOKEN` | No | Auto-injected by Vercel for OIDC identity verification. |

---

## 16. Subsystem Dependencies Map

```
app/qsaas/runner/page.tsx
  ├── components/runner/*           (all runner panels)
  ├── lib/circuit-builder.ts        (analyzeInputData, buildCircuit)
  ├── lib/backend-selector.ts       (selectOptimalBackend, calculateFidelity)
  ├── hooks/use-live-executions.ts  (SSE subscription)
  ├── hooks/use-live-mode.ts        (broadcastExecution)
  ├── contexts/digital-twin-mode-context.tsx
  └── contexts/synthetic-mode-context.tsx

app/api/quantum/simulate/route.ts
  ├── lib/api-auth.ts               (authenticateRequest)
  ├── lib/security.ts               (validateInputData, validateQASM, sanitize)
  ├── lib/rate-limiter.ts           (checkRateLimit)
  ├── lib/circuit-builder.ts        (buildCircuit)
  ├── lib/backend-policy.ts         (selectBackendByPolicy)
  ├── lib/ml/cpp-ml-engine.ts       (recommendParams, recordExecution)
  ├── lib/db/client.ts              (Executions.create)
  └── lib/qasm-processor.ts         (optional C++ path)

lib/qasm-processor.ts
  ├── lib/circuit-builder.ts        (TS path for small/medium)
  └── scripts/generate_circuit.cpp  (C++ path for large/massive, via spawn)

lib/db/client.ts
  └── lib/db/init.ts                (ensures tables exist before any query)

lib/auth-utils.ts
  └── lib/db/client.ts              (selfHealFromJWT recreates rows)

sdk/python/planck_sdk/client.py
  └── POST /api/quantum/simulate    (HTTP, x-api-key auth)
      └── lib/api-auth.ts → lib/db/client.ts (ApiKeys.findByKey)

components/dashboard/digital-twin-dashboard.tsx
  ├── hooks/use-live-executions.ts  (SSE via /api/quantum/stream)
  ├── components/dashboard/execution-charts.tsx
  └── lib/types/ (ExecutionRow interface)
```

---

## 17. Security Model

| Control | Implementation |
|---|---|
| **Authentication** | JWT (7-day) or API key (64-char hex). Dual-path via `lib/api-auth.ts`. |
| **Input validation** | QASM injection detection, payload size limits (1MB data, 100KB QASM). |
| **SQL injection** | All SQLite queries use parameterised statements (`better-sqlite3` prepared statements). |
| **XSS** | `sanitizeString()` applies HTML entity encoding + pattern removal before persistence. |
| **Rate limiting** | Token bucket: 1 request per 3 seconds per user. In-memory, per Lambda instance. |
| **Error redaction** | `createSafeErrorResponse()` strips stack traces and internal paths from error responses. |
| **CORS** | `validateRequestHeaders()` checks Origin and required headers. |
| **API key format** | v0.9: pure 64-char hex. Validated by regex before DB lookup. |
| **Data deletion** | Full cascade delete on account removal. GDPR-ready soft-delete for execution history. |

> **Note:** The `JWT_SECRET` in `.env.local` is a development placeholder. Replace with a cryptographically random 256-bit secret in production.

---

*Planck Technologies — hello@plancktechnologies.xyz*
*© 2024–2026 Planck Technologies. All rights reserved.*