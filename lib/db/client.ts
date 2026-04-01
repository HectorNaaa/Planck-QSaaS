import db, { initializeDatabase } from './init'

// Initialize database on first import
initializeDatabase()

// User operations
export const Users = {
  create: (email: string, passwordHash: string) => {
    const id = crypto.getRandomValues(new Uint8Array(16)).toString()
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
    const id = crypto.getRandomValues(new Uint8Array(16)).toString()
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
    const id = crypto.getRandomValues(new Uint8Array(16)).toString()
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
  create: (userId: string, circuitId: string | null, backend: string) => {
    const id = crypto.getRandomValues(new Uint8Array(16)).toString()
    const stmt = db.prepare(
      'INSERT INTO executions (id, user_id, circuit_id, backend, status) VALUES (?, ?, ?, ?, ?)'
    )
    stmt.run(id, userId, circuitId, backend, 'pending')
    return { id }
  },

  findByUserId: (userId: string) => {
    const stmt = db.prepare('SELECT * FROM executions WHERE user_id = ? ORDER BY created_at DESC')
    return stmt.all(userId) as any[]
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
  }
}

// API Key operations
export const ApiKeys = {
  create: (userId: string, name: string, key: string) => {
    const id = crypto.getRandomValues(new Uint8Array(16)).toString()
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
