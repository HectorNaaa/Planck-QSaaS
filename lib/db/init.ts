import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// Ensure data directory exists
const dataDir = process.env.DB_DIR || path.join(process.cwd(), '.data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'planck.db')

// Create or open database
const db = new Database(dbPath)

// Enable foreign keys
db.pragma('foreign_keys = ON')

// Initialize schema if not exists
export function initializeDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Create profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT,
      organization TEXT,
      theme_preference TEXT DEFAULT 'dark',
      language TEXT DEFAULT 'en',
      phone TEXT,
      country TEXT,
      occupation TEXT,
      verified BOOLEAN DEFAULT 0,
      stay_logged_in BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create circuits table
  db.exec(`
    CREATE TABLE IF NOT EXISTS circuits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      circuit_data TEXT NOT NULL,
      qasm TEXT,
      backend TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create executions table with full circuit execution metadata
  db.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      circuit_id TEXT,
      circuit_name TEXT,
      algorithm TEXT,
      execution_type TEXT DEFAULT 'manual',
      backend TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      success_rate REAL,
      runtime_ms INTEGER,
      qubits_used INTEGER,
      shots INTEGER,
      error_mitigation TEXT,
      backend_selected TEXT,
      backend_reason TEXT,
      backend_hint TEXT,
      backend_metadata TEXT,
      backend_assigned_at DATETIME,
      circuit_data TEXT,
      result TEXT,
      error TEXT,
      execution_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (circuit_id) REFERENCES circuits(id) ON DELETE SET NULL
    )
  `)

  // Create API keys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      key TEXT UNIQUE NOT NULL,
      name TEXT,
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  // Create indices
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_circuits_user_id ON circuits(user_id);
    CREATE INDEX IF NOT EXISTS idx_executions_user_id ON executions(user_id);
    CREATE INDEX IF NOT EXISTS idx_executions_circuit_id ON executions(circuit_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
  `)

  // ── Migrations: add columns that may be missing on older DBs ──
  const profileCols = db.pragma('table_info(profiles)') as { name: string }[]
  const colNames = new Set(profileCols.map((c) => c.name))
  if (!colNames.has('country')) {
    db.exec("ALTER TABLE profiles ADD COLUMN country TEXT DEFAULT ''")
  }
  if (!colNames.has('occupation')) {
    db.exec("ALTER TABLE profiles ADD COLUMN occupation TEXT DEFAULT ''")
  }
  if (!colNames.has('ui_preferences')) {
    db.exec("ALTER TABLE profiles ADD COLUMN ui_preferences TEXT DEFAULT NULL")
  }
  // ── Multi-device session awareness: lets us warn a newly-logging-in device
  // that the account is already open elsewhere, without forcibly logging the
  // other device out (JWT remains the source of truth for auth itself). ──
  if (!colNames.has('active_session_id')) {
    db.exec("ALTER TABLE profiles ADD COLUMN active_session_id TEXT DEFAULT NULL")
  }
  if (!colNames.has('active_session_started_at')) {
    db.exec("ALTER TABLE profiles ADD COLUMN active_session_started_at DATETIME DEFAULT NULL")
  }
  if (!colNames.has('active_session_device')) {
    db.exec("ALTER TABLE profiles ADD COLUMN active_session_device TEXT DEFAULT NULL")
  }

  // ── Scenario / batch metadata columns ─────────────────────────────────────
  const execCols = db.pragma('table_info(executions)') as { name: string }[]
  const execColNames = new Set(execCols.map((c) => c.name))
  const scenarioCols: { name: string; def: string }[] = [
    { name: 'scenario_id',    def: 'TEXT DEFAULT NULL' },
    { name: 'scenario_name',  def: 'TEXT DEFAULT NULL' },
    { name: 'scenario_type',  def: 'TEXT DEFAULT NULL' },
    { name: 'objective',      def: 'TEXT DEFAULT NULL' },
    { name: 'risk_tolerance', def: 'TEXT DEFAULT NULL' },
    { name: 'batch_id',       def: 'TEXT DEFAULT NULL' },
    { name: 'batch_index',    def: 'INTEGER DEFAULT NULL' },
    { name: 'batch_size',     def: 'INTEGER DEFAULT NULL' },
    { name: 'strategy',       def: 'TEXT DEFAULT NULL' },
    { name: 'compute_route',  def: 'TEXT DEFAULT NULL' },
  ]
  for (const col of scenarioCols) {
    if (!execColNames.has(col.name)) {
      db.exec(`ALTER TABLE executions ADD COLUMN ${col.name} ${col.def}`)
    }
  }

  // ── Finance digital twins (additive — Risk Scenario / Collateral & Liquidity / Execution-RFQ) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_twins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finance_snapshots (
      id TEXT PRIMARY KEY,
      twin_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      snapshot_hash TEXT NOT NULL,
      model TEXT,
      constraints TEXT,
      data TEXT NOT NULL,
      is_synthetic BOOLEAN DEFAULT 1,
      seed INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (twin_id) REFERENCES finance_twins(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS finance_runs (
      id TEXT PRIMARY KEY,
      execution_id TEXT,
      snapshot_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      module_id TEXT NOT NULL,
      execution_mode TEXT NOT NULL,
      solver_actual TEXT,
      status TEXT DEFAULT 'pending',
      is_synthetic BOOLEAN DEFAULT 1,
      seed INTEGER,
      model_version TEXT,
      calibration_status TEXT,
      lineage TEXT,
      result TEXT,
      kpis TEXT,
      baseline TEXT,
      warnings TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE SET NULL,
      FOREIGN KEY (snapshot_id) REFERENCES finance_snapshots(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_finance_twins_user ON finance_twins(user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_snapshots_user ON finance_snapshots(user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_snapshots_twin ON finance_snapshots(twin_id);
    CREATE INDEX IF NOT EXISTS idx_finance_runs_user ON finance_runs(user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_runs_snapshot ON finance_runs(snapshot_id);
  `)

  // ── Finance twins: reusable/saved instances + private-by-default publishing ──
  // Additive columns so pre-existing finance_twins rows (created one-per-run) keep working.
  const twinCols = db.pragma('table_info(finance_twins)') as { name: string }[]
  const twinColNames = new Set(twinCols.map((c) => c.name))
  const financeTwinCols: { name: string; def: string }[] = [
    { name: 'description',     def: "TEXT DEFAULT NULL" },
    { name: 'tags',            def: "TEXT DEFAULT '[\"finance\"]'" },
    { name: 'config',          def: "TEXT DEFAULT NULL" },
    { name: 'visibility',      def: "TEXT NOT NULL DEFAULT 'private'" },
    { name: 'kind',            def: "TEXT NOT NULL DEFAULT 'ephemeral'" },
    { name: 'source_twin_id',  def: "TEXT DEFAULT NULL" },
    { name: 'published_at',    def: "DATETIME DEFAULT NULL" },
    { name: 'updated_at',      def: "DATETIME DEFAULT NULL" },
  ]
  for (const col of financeTwinCols) {
    if (!twinColNames.has(col.name)) {
      db.exec(`ALTER TABLE finance_twins ADD COLUMN ${col.name} ${col.def}`)
    }
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_finance_twins_kind_user ON finance_twins(kind, user_id);
    CREATE INDEX IF NOT EXISTS idx_finance_twins_visibility ON finance_twins(kind, visibility);
  `)

  // ── Server-side entitlements / quota gate (additive — no client-supplied plan/quota is ever trusted) ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS plan_limits (
      plan TEXT PRIMARY KEY,
      max_executions_per_cycle INTEGER NOT NULL,
      max_concurrent_jobs INTEGER NOT NULL,
      max_compute_ms_per_cycle INTEGER NOT NULL,
      max_storage_bytes INTEGER NOT NULL,
      cycle_length_days INTEGER NOT NULL DEFAULT 30,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS entitlements (
      user_id TEXT PRIMARY KEY,
      plan TEXT NOT NULL DEFAULT 'starter',
      cycle_start DATETIME DEFAULT CURRENT_TIMESTAMP,
      executions_used INTEGER DEFAULT 0,
      compute_ms_used INTEGER DEFAULT 0,
      storage_bytes_used INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quota_reservations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'reserved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_quota_reservations_user ON quota_reservations(user_id);
    CREATE INDEX IF NOT EXISTS idx_quota_reservations_status ON quota_reservations(status);
    CREATE INDEX IF NOT EXISTS idx_entitlements_plan ON entitlements(plan);
  `)

  // Conservative pilot defaults — aligned with the marketed Starter/Professional
  // run caps in lib/constants.ts (PRICING_PLANS). Editable in-place via the
  // plan_limits table without a redeploy; these INSERTs only seed first-run
  // defaults and never overwrite an existing (possibly hand-tuned) row.
  const seedPlanLimits = db.prepare(`
    INSERT OR IGNORE INTO plan_limits
      (plan, max_executions_per_cycle, max_concurrent_jobs, max_compute_ms_per_cycle, max_storage_bytes, cycle_length_days)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  seedPlanLimits.run('free', 100, 1, 5 * 60_000, 10 * 1024 * 1024, 30)
  seedPlanLimits.run('starter', 1000, 2, 60 * 60_000, 50 * 1024 * 1024, 30)
  seedPlanLimits.run('professional', 50000, 5, 8 * 60 * 60_000, 50 * 1024 * 1024, 30)
  // Enterprise is not "unlimited" infrastructure — this is a high technical
  // ceiling that protects shared infra pending a dedicated contract review.
  seedPlanLimits.run('enterprise', 1_000_000, 20, 24 * 60 * 60_000, 50 * 1024 * 1024, 30)
}

// Initialize database automatically on import
try {
  initializeDatabase()
  console.log('[DB] Database initialized successfully at:', dbPath)
} catch (error) {
  console.error('[DB] Failed to initialize database:', error)
  // Continue anyway - tables may already exist
}

export default db
