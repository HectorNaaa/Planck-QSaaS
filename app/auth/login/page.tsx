"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Eye, EyeOff, UserRound, AlertCircle } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { LoadingSpinner } from "@/components/loading-spinner"

function getErrorMessage(err: unknown): string {
  if (!err) return "An error occurred. Please try again."
  if (typeof err === "string" && err && err !== "{}") return err
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>
    if (typeof obj.status === "number") {
      if (obj.status === 503) return "Authentication service temporarily unavailable. Please try again in a moment."
      if (obj.status === 429) return "Too many requests. Please wait a moment and try again."
      if (obj.status === 400 || obj.status === 401) return "Invalid email or password."
      if (obj.status === 422) return "Email not found or invalid format."
      if (obj.status >= 500) return "Server error. Please try again shortly."
    }
    if (obj.__isAuthError) {
      if (obj.name === "AuthRetryableFetchError") return "Cannot reach authentication server. Please check your connection."
      if (typeof obj.message === "string" && obj.message && obj.message !== "{}") return obj.message
    }
    if (typeof obj.message === "string" && obj.message && obj.message !== "{}") return obj.message
    if (typeof obj.error_description === "string" && obj.error_description) return obj.error_description
  }
  if (err instanceof Error && err.message && err.message !== "{}") return err.message
  return "An error occurred. Please try again."
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const missingEnv = !supabaseUrl || !supabaseKey

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isGuestLoading, setIsGuestLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) { setError("Email is required."); return }
    if (!password) { setError("Password is required."); return }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Login failed")
        return
      }

      sessionStorage.setItem("planck_nav_source", "auth")
      router.push("/qsaas/dashboard")
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleGuest = () => {
    setIsGuestLoading(true)
    document.cookie = `planck_guest=true; max-age=${2 * 60 * 60}; path=/; SameSite=Strict`
    router.push("/qsaas/dashboard")
  }

  if (missingEnv) {
    return (
      <div className="w-full max-w-md px-4">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3 text-destructive">
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
              <p className="text-sm">
                Supabase environment variables are missing. Please set{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
        <ThemeToggle />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Sign in to your Planck account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
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
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-input border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Signing in...
                </span>
              ) : "Sign In"}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGuest}
            disabled={isGuestLoading}
          >
            {isGuestLoading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                Entering...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <UserRound size={16} />
                Continue as Guest
              </span>
            )}
          </Button>

          <p className="mt-6 text-center text-sm">
            {"Don't have an account? "}
            <Link href="/auth/sign-up" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

