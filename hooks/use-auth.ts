import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'

interface User {
  id: string
  email: string | undefined
  name?: string
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getSession = async () => {
      try {
        const supabase = createBrowserClient()
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError) throw authError

        if (authUser) {
          setUser({
            id: authUser.id,
            email: authUser.email,
            name: authUser.user_metadata?.first_name ? 
              `${authUser.user_metadata.first_name} ${authUser.user_metadata.last_name || ''}`.trim() :
              authUser.email
          })
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Session error:', err)
        setError(err instanceof Error ? err.message : 'Session error')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    getSession()
  }, [])

  return { user, loading, error }
}
