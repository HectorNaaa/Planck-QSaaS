import db, { initializeDatabase } from './init'
import { randomUUID } from 'node:crypto'

// Initialize database on first import
initializeDatabase()

// User operations
export const Users = {
  create: (email: string, passwordHash: string) => {
    const id = randomUUID()
    const stmt = db.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    )
    stmt.run(id, email, passwordHash)
    return { id, email }
  },

  findByEmail: (email: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    return stmt.get(email) as any
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
    return stmt.get(id) as any
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?')
    return stmt.run(id)
  }
}

// Profile operations
export const Profiles = {
  create: (userId: string, fullName?: string, organization?: string) => {
    const id = randomUUID()
    const stmt = db.prepare(
      'INSERT INTO profiles (id, user_id, full_name, organization) VALUES (?, ?, ?, ?)'
    )
    stmt.run(id, userId, fullName || null, organization || null)
    return { id, userId }
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM profiles WHERE user_id = ?')
    return stmt.get(userId) as any
  },

  update: (userId: string, data: Record<string, any>) => {
    const fields = Object.keys(data)
      .map(k => `${k} = ?`)
      .join(', ')
    const values = Object.values(data)
    values.push(userId)

    const stmt = db.prepare(
      `UPDATE profiles SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`
    )
    return stmt.run(...values)
  }
}

// Circuit operations
export const Circuits = {
  create: (userId: string, name: string, circuitData: string, qasm?: string) => {
    const id = randomUUID()
    const stmt = db.prepare(
      'INSERT INTO circuits (id, user_id, name, circuit_data, qasm) VALUES (?, ?, ?, ?, ?)'
    )
    stmt.run(id, userId, name, circuitData, qasm || null)
    return { id }
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM circuits WHERE user_id = ? ORDER BY created_at DESC')
    return stmt.all(userId) as any[]
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM circuits WHERE id = ?')
    return stmt.get(id) as any
  },

  update: (id: string, data: Record<string, any>) => {
    const fields = Object.keys(data)
      .map(k => `${k} = ?`)
      .join(', ')
    const values = Object.values(data)
    values.push(id)

    const stmt = db.prepare(
      `UPDATE circuits SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    return stmt.run(...values)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM circuits WHERE id = ?')
    return stmt.run(id)
  }
}

// Execution operations
export const Executions = {
  create: (data: {
    user_id: string
    circuit_id?: string | null
    circuit_name?: string
    algorithm?: string
    execution_type?: string
    backend: string
    status?: string
    success_rate?: number
    runtime_ms?: number
    qubits_used?: number
    shots?: number
    error_mitigation?: string
    backend_selected?: string
    backend_reason?: string
    backend_hint?: string | null
    backend_metadata?: string
    backend_assigned_at?: string
    circuit_data?: string
    result?: string
    error?: string
    // Scenario / batch metadata
    scenario_id?: string | null
    scenario_name?: string | null
    scenario_type?: string | null
    objective?: string | null
    risk_tolerance?: string | null
    batch_id?: string | null
    batch_index?: number | null
    batch_size?: number | null
    strategy?: string | null
    compute_route?: string | null
  }) => {
    const id = randomUUID()
    const stmt = db.prepare(`
      INSERT INTO executions (
        id, user_id, circuit_id, circuit_name, algorithm, execution_type,
        backend, status, success_rate, runtime_ms, qubits_used, shots,
        error_mitigation, backend_selected, backend_reason, backend_hint,
        backend_metadata, backend_assigned_at, circuit_data, result, error,
        scenario_id, scenario_name, scenario_type, objective, risk_tolerance,
        batch_id, batch_index, batch_size, strategy, compute_route
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      id,
      data.user_id,
      data.circuit_id || null,
      data.circuit_name || null,
      data.algorithm || null,
      data.execution_type || 'manual',
      data.backend,
      data.status || 'pending',
      data.success_rate || null,
      data.runtime_ms || null,
      data.qubits_used || null,
      data.shots || null,
      data.error_mitigation || null,
      data.backend_selected || null,
      data.backend_reason || null,
      data.backend_hint || null,
      data.backend_metadata || null,
      data.backend_assigned_at || null,
      data.circuit_data || null,
      data.result || null,
      data.error || null,
      // Scenario / batch metadata
      data.scenario_id || null,
      data.scenario_name || null,
      data.scenario_type || null,
      data.objective || null,
      data.risk_tolerance || null,
      data.batch_id || null,
      data.batch_index ?? null,
      data.batch_size ?? null,
      data.strategy || null,
      data.compute_route || null,
    )
    return { id, changes: result.changes }
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM executions WHERE user_id = ? ORDER BY created_at DESC')
    return stmt.all(userId) as any[]
  },

  /** Return rows newer than `since` (ISO timestamp), ordered oldest→newest. */
  findByUserIdSince: (userId: string, since: string, digitalTwinId?: string | null) => {
    if (digitalTwinId) {
      const stmt = db.prepare(
        `SELECT * FROM executions
         WHERE user_id = ? AND created_at > ?
               AND json_extract(circuit_data, '$.digital_twin_id') = ?
         ORDER BY created_at ASC`
      )
      return stmt.all(userId, since, digitalTwinId) as any[]
    }
    const stmt = db.prepare(
      'SELECT * FROM executions WHERE user_id = ? AND created_at > ? ORDER BY created_at ASC'
    )
    return stmt.all(userId, since) as any[]
  },

  findById: (id: string) => {
    const stmt = db.prepare('SELECT * FROM executions WHERE id = ?')
    return stmt.get(id) as any
  },

  updateStatus: (id: string, status: string, result?: string, error?: string) => {
    const stmt = db.prepare(
      'UPDATE executions SET status = ?, result = ?, error = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
    return stmt.run(status, result || null, error || null, id)
  },

  deleteById: (id: string) => {
    const stmt = db.prepare('DELETE FROM executions WHERE id = ?')
    return stmt.run(id)
  },

  deleteByUserId: (userId: string) => {
    const stmt = db.prepare('DELETE FROM executions WHERE user_id = ?')
    return stmt.run(userId)
  },

  /** Approximate on-disk size of a user's execution history in bytes. */
  getStorageSizeByUserId: (userId: string): number => {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(
        LENGTH(COALESCE(circuit_data, '')) +
        LENGTH(COALESCE(result, '')) +
        LENGTH(COALESCE(error, '')) + 250
      ), 0) AS total_bytes
      FROM executions WHERE user_id = ?
    `)
    const row = stmt.get(userId) as { total_bytes: number } | undefined
    return row?.total_bytes ?? 0
  },
}

// API Key operations
export const ApiKeys = {
  create: (userId: string, name: string, key: string) => {
    const id = randomUUID()
    const stmt = db.prepare(
      'INSERT INTO api_keys (id, user_id, key, name) VALUES (?, ?, ?, ?)'
    )
    stmt.run(id, userId, key, name)
    return { id, key }
  },

  findByKey: (key: string) => {
    const stmt = db.prepare('SELECT * FROM api_keys WHERE key = ?')
    return stmt.get(key) as any
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT id, name, created_at, last_used FROM api_keys WHERE user_id = ?')
    return stmt.all(userId) as any[]
  },

  /** Internal: returns the full key value for JWT embedding. Not exposed to clients. */
  findKeyValueByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT key FROM api_keys WHERE user_id = ? LIMIT 1')
    const row = stmt.get(userId) as { key: string } | undefined
    return row?.key || null
  },

  updateLastUsed: (key: string) => {
    const stmt = db.prepare('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE key = ?')
    return stmt.run(key)
  },

  delete: (id: string) => {
    const stmt = db.prepare('DELETE FROM api_keys WHERE id = ?')
    return stmt.run(id)
  }
}

export default db
