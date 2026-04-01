import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db/init'

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const result = db.prepare('SELECT 1 as connected').get() as any
    
    // Count tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
    `).all() as any[]
    
    // Get user count
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any
    
    return NextResponse.json({
      status: 'ok',
      database: {
        connected: result?.connected === 1,
        tables: tables.map(t => t.name),
        userCount: userCount?.count || 0,
        environment: process.env.NODE_ENV,
        dbDir: process.env.DB_DIR || '.data'
      }
    })
  } catch (error) {
    console.error('[DB_STATUS] Error:', error)
    return NextResponse.json({
      status: 'error',
      message: String(error),
      dbDir: process.env.DB_DIR || '.data'
    }, { status: 500 })
  }
}
