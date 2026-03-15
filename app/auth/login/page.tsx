"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { LoadingSpinner } from "@/components/loading-spinner"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const supabase = createClient()

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
        return
      }

      // Ensure a profile row exists (may have been lost during DB outage)
      if (authData.user) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", authData.user.id)
            .maybeSingle()

          if (!profile) {
            // Recreate profile row from auth metadata
            const meta = authData.user.user_metadata ?? {}
            const { error: upsertErr } = await supabase.from("profiles").upsert({
              id: authData.user.id,
              email: authData.user.email,
              name: meta.name ?? meta.full_name ?? email.split("@")[0],
              country: meta.country ?? "",
              country_code: meta.country_code ?? "",
              phone_number: meta.phone_number ?? "",
              occupation: meta.occupation ?? "",
              organization: meta.organization ?? "",
              email_verified: !!authData.user.confirmed_at,
            }, { onConflict: "id" })

            if (upsertErr) {
              console.error("[v0] Profile upsert error during login:", upsertErr)
              // Non-fatal: continue even if profile upsert fails
            }
          }
        } catch (profileErr) {
          console.error("[v0] Profile check/upsert error:", profileErr)
          // Non-fatal: profile issues don't block login
        }
      }

      document.cookie = `planck_session=active; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Strict`
      sessionStorage.setItem("planck_nav_source", "auth")
      router.push("/qsaas/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/isotipo-20planck-20png.png"
            alt="Planck"
            width={40}
            height={40}
            className="object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Sign in to your Planck account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-input border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {"Don't have an account? "}
            <Link href="/auth/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
