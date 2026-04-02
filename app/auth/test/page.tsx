"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function AuthTestPage() {
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testLogin = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/auth/login/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      setResult({ status: res.status, data })
      console.log('Test result:', data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  const testDBHealth = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/debug/db/check')
      const data = await res.json()
      setResult({ status: res.status, data })
      console.log('DB health:', data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  const testRawDebug = async () => {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/auth/debug/raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      setResult({ status: res.status, data })
      console.log('Raw debug:', data)
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Debug</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
              />
            </div>
            <div>
              <Label>Password</Label>
              <Input 
                type="password"
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            <div className="space-y-2">
              <Button onClick={testLogin} disabled={loading} className="w-full">
                {loading ? 'Testing...' : 'Test Login'}
              </Button>
              <Button onClick={testDBHealth} disabled={loading} variant="outline" className="w-full">
                {loading ? 'Testing...' : 'Test DB Health'}
              </Button>
              <Button onClick={testRawDebug} disabled={loading} variant="outline" className="w-full">
                {loading ? 'Testing...' : 'Test Raw Debug'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
