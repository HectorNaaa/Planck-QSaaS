# AGENTS.md — Planck QSaaS

## Project Identity

**Planck-QSaaS** is a Hybrid Quantum Digital Twins SaaS platform by Planck Technologies. It lets users upload datasets, run quantum algorithms (VQE, QAOA, Grover, Shor, QFT, Bell) on simulated backends, and track results via persistent "Digital Twins" — all without writing QASM.

- **Framework**: Next.js 16 (App Router) deployed on Vercel
- **Package manager**: pnpm (see `.npmrc` for config)
- **Path alias**: `@/` maps to project root
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss"` not `@tailwind`), shadcn/ui New York style, `next-themes` for dark mode
- **Database**: SQLite via `better-sqlite3` (stored in `/tmp` on Vercel, `./.data` locally)
- **C++ layer**: Compiled binaries in `scripts/` for circuit generation/transpilation (silent TS fallback)
- **Python SDK**: Published as `planck_sdk` on PyPI, lives in `sdk/python/`

---

## Essential Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run vitest tests (from `__tests__/`) |
| `pnpm lint` | ESLint |
| `pnpm test -- --coverage` | Tests with coverage (threshold: 80% stmts/br/fn/lines) |
| `npm test -- --coverage` | Same — CI uses npm, dev uses pnpm |
| *(from `sdk/python/`)* `python -m pytest --tb=short -v` | Run Python SDK tests |

**CI**: GitHub Actions (`.github/workflows/test.yml`) runs on `workflow_dispatch` only. Node 22 + Python 3.12.

---

## Code Organization

```
app/                          # Next.js App Router
  qsaas/                      # Authenticated app shell + pages
    runner/                   # The core product page (circuit execution)
    dashboard/                # Execution history + charts
    settings/                 # Profile, API keys, preferences
    billing/                  # Pricing plans
    templates/                # Algorithm templates
  api/                        # API route handlers
    quantum/                  # simulate, stream, generate-circuit, visualize,
                              # transpile, digital-twin, ml-recommend, health, assistant
    auth/                     # login, logout, signup
    user/                     # preferences
    dashboard/                # aggregated data
    request-utils/            # session check endpoint
  (auth, privacy, terms)      # Public pages
  globals.css                 # Tailwind v4 + CSS variables (green-primary theme)

components/
  ui/                         # shadcn/ui primitives (button, card, input, select...)
  runner/                     # Circuit runner panels (autoparser, circuit-settings,
                              #   execution-settings, digital-twin-panel, scenario-comparison...)
  dashboard/                  # Digital-twin dashboard, execution charts
  layout/                     # sidebar, mobile-bottom-nav, main-layout, protected-route

lib/                          # Server-only business logic (never from client)
  circuit-builder.ts          # DataProfile → parametric QASM generator
  qasm-processor.ts           # Orchestrator: TS gen → C++ gen/transpile fallback chain
  backend-selector.ts         # Pure functions for optimal backend selection
  backend-policy.ts           # Auditable policy wrapper (latency_first/cost_first/capacity_first)
  circuit-utils.ts            # Shared pure helpers (qubit extraction, adaptive shots)
  api-auth.ts                 # Request auth (API key header → session cookie)
  auth-utils.ts               # JWT generation/verification, password hashing
  security.ts                 # Input validation, sanitization, injection detection
  rate-limiter.ts             # Token-bucket (1 req/3s per user)
  verification-service.ts     # Email/SMS verification (stub — localStorage only)
  translator.ts               # OpenQASM ↔ other formats
  constants.ts                # Algorithm templates, pricing plans, defaults
  db/
    init.ts                   # SQLite schema + auto-migration via pragma
    client.ts                 # Typed DB wrappers (Users, Profiles, Circuits, Executions, ApiKeys)
    ensure-user.ts            # Best-effort user row creation on session auth
  ml/
    cpp-ml-engine.ts          # ML recommendation (TS fallback; C++ vectorizer commented out)
  utils.ts                    # `cn()` helper (clsx + tailwind-merge)

hooks/                        # React hooks
  use-live-executions.ts      # SSE connection to /api/quantum/stream
  use-live-mode.ts            # Session-storage-based live toggle + BroadcastChannel
  use-mobile.ts               # Mobile detection

contexts/                     # React contexts (providers in app/qsaas/layout.tsx)
  synthetic-mode-context.tsx   # Synthetic Data Runner loop (survives page nav)
  digital-twin-mode-context.tsx
  ui-preferences-context.tsx
  language-context.tsx

sdk/python/                   # Python SDK published to PyPI
  planck_sdk/                 # client.py, circuit.py, result.py, exceptions.py
  tests/                      # pytest tests

scripts/                      # C++17 + QASM templates
  generate_circuit.cpp        # Fast QASM generator for ≥50K-row datasets
  transpile_circuit.cpp       # Gate fusion + CX cancellation
  algorithms/                 # .qasm template files

__tests__/                    # Vitest test files
  backend-selector.test.ts
  exec-cache-sdk-live.test.ts
  execution-json-shape.test.ts

Planck-QSaaS/                 # External files (excluded from TypeScript)
coverage/                     # Coverage reports (gitignored)
```

---

## Architecture & Data Flow

```
Browser/Client  ←── HTTP/SSE ──→  API Routes (app/api/)  ←→  lib/ (business logic)
                                        │
                               SQLite (better-sqlite3)
                                        │
                                  C++ binaries
                                (scripts/ *.cpp)
```

### Three logical layers

```
Presentation (app/ + components/)   — React, never touches DB directly
API Layer (app/api/)                — Route handlers, auth, validation, orchestration
Business Logic (lib/)               — Pure functions, circuit gen, backend selection, auth, DB
Native Layer (scripts/)             — C++17 binaries (optional; silent TS fallback)
```

### API Request Pipeline (see `app/api/quantum/simulate/route.ts`)

1. Validate request headers
2. Validate payload size (1 MB max)
3. Parse & validate all inputs (algorithm, backend, shots, QASM, etc.)
4. Authenticate (API key header → session cookie)
5. Check storage cap (50 MB per user)
6. Rate-limit check (token bucket, 1 req / 3 s)
7. Execute (circuit gen → ML tuning → backend policy → simulation → store result)
8. Return JSON response

### SSE real-time flow (`app/api/quantum/stream/route.ts`)

- Client opens EventSource to `/api/quantum/stream?since=<ISO timestamp>`
- Server polls `executions` table every 3 seconds for new rows
- Web Streams API with keep-alive comment every 15 seconds
- `maxDuration = 300` (Vercel Pro)
- API key passed as query param (EventSource can't set headers)
- BroadcastChannel (`"planck_live"`) notifies other tabs of new executions instantly

---

## Naming & Style Conventions

- **TypeScript** throughout (strict mode, `noEmit: true`)
- **File naming**: `kebab-case.ts` or `kebab-case.tsx`
- **Exports**: Named exports preferred, types at top of file
- **JSDoc**: Block comments with ASCII `───` header separators at file top
- **Components**: PascalCase, `"use client"` directive when needed
- **CSS**: Tailwind utility classes, CSS variables for theming, `cn()` helper for class merging
- **Validation functions**: Return default values on invalid input (never throw) — e.g., `validateAlgorithm("bad")` → `"vqe"`
- **DB client**: Object-based API (`Users.create()`, `Executions.findByUserId()`)
- **Imports**: Use `@/` path alias exclusively

---

## Testing Patterns

- **Vitest** with `@vitest/coverage-v8` (environment: `node`, no JSDOM)
- Coverage threshold: 80% across statements/branches/functions/lines
- **Critical pattern**: Some test files **inline copies** of source functions (instead of importing) — this is intentional so source changes are caught as test regressions. See `exec-cache-sdk-live.test.ts` and `execution-json-shape.test.ts`.
- Tests use in-memory localStorage stubs (`MemStorage` class)
- Test data uses factories (`makeRow()`, shared fixtures like `dbRow`, `QASM`)
- Python SDK tests live in `sdk/python/tests/`, run with pytest

---

## Database

**SQLite** via `better-sqlite3`. Schema in `lib/db/init.ts`.

| Table | Key fields |
|-------|-----------|
| `users` | id, email, password_hash |
| `profiles` | user_id, full_name, organization, theme_preference, country, occupation, api_key, ui_preferences |
| `circuits` | user_id, name, circuit_data, qasm |
| `executions` | user_id, circuit_id, circuit_name, algorithm, backend, status, success_rate, runtime_ms, qubits_used, shots, error_mitigation, backend_selected, circuit_data (JSON), result, + scenario/batch metadata columns |
| `api_keys` | user_id, key, name, last_used |

**Auto-migration**: Uses `pragma table_info()` to add missing columns (country, occupation, ui_preferences, scenario/batch columns). No migration tooling.

**Storage cap**: 50 MB per user (checked in simulate route).

---

## Important Gotchas

1. **Ephemeral SQLite on Vercel** — DB lives in `/tmp` and can be wiped on cold start. Mitigations:
   - JWT payload stores password hash (`ph`) and API key (`ak`) for self-healing
   - `ensureDbUser()` in `lib/db/ensure-user.ts` is called on every session auth
   - localStorage execution cache (up to 100 rows in `planck_exec_cache`) fills gaps
   - Dashboard merges 3 data sources: server DB, localStorage cache, SSE stream
2. **C++ binary fallback** — `generate_circuit` and `transpile_circuit` silently fall back to pure-TS when binaries aren't compiled. The threshold for C++ generation is >= 50,000 samples.
3. **SSE API key via query param** — EventSource can't send custom headers, so `/api/quantum/stream` accepts `?api_key=` as fallback alongside the normal `x-api-key` header.
4. **BroadcastChannel** — Cross-tab sync via `BroadcastChannel("planck_live")`. Always guarded with `typeof BroadcastChannel === "undefined"` check for environments that don't support it.
5. **JWT is source of truth** — Session validation never hits the database. JWT payload includes all user profile data. DB writes (`ensureDbUser`) are best-effort.
6. **Memory-bounded sampling** — `analyzeInputData()` caps stats computation at 5,000 rows (constant memory) but `sampleCount` reflects the full dataset. This means qubit/layer scaling is based on actual data volume, not the sample.
7. **Validator defaults** — All validation functions in `lib/security.ts` return safe defaults for invalid input rather than throwing. E.g., `validateAlgorithm("nope")` → `"vqe"`.
8. **SDK/UI constant sync** — Backends, error mitigation levels, and algorithms are defined identically in both `lib/security.ts` (TypeScript) and `sdk/python/planck_sdk/client.py` (Python). They must be kept in sync.
9. **pnpm-only** — The project uses pnpm (`.npmrc` sets `package-manager=pnpm`). CI runs `npm ci` but dev should use pnpm.
10. **Tailwind v4 syntax** — Uses `@import "tailwindcss"` (not `@tailwind` directives), `@custom-variant dark` instead of `dark:` class in config.
11. **Vercel deploy is disabled** — `vercel.json` has `"git": {"deploymentEnabled": false}`. Deployment is triggered externally.
12. **Turbopack enabled** — `next.config.mjs` uses Turbopack for the dev server.
13. **`Planck-QSaaS/` directory** — Excluded from TypeScript compilation (`tsconfig.json` exclude). May contain external or generated content.
14. **Coverage reports** — Live in `coverage/` at root level. Not gitignored (present in listing).
15. **Synthetic Data Runner** — Runs in a React context (`synthetic-mode-context.tsx`) that persists across page navigation because it's mounted in the QSaaS layout, not the runner page.

---

## Deployment

- **Production**: Vercel (automatic from `main` branch — external trigger)
- **Python SDK**: `sdk/python/` published to PyPI via `publish-sdk.yml` (push tag `sdk/v*`)
- **Environment variables** (see `.env.example`): `DB_DIR`, `JWT_SECRET`, `NEXT_PUBLIC_VERCEL_ANALYTICS_ID`
- **Vercel config** (`vercel.json`): build with `pnpm run build`, install with `pnpm install`, DB at `/tmp`
- **`.vercelignore`**: Excludes `.env*.local`, `.next`, `node_modules`, `.git`
