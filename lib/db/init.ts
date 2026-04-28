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
