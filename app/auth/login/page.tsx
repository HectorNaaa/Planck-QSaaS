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

/** Safely extract an error message from any error type */
function getErrorMessage(err: unknown): string {
  console.log("[v0] getErrorMessage called with:", err, "type:", typeof err)
  
  if (!err) return "An unknown error occurred"
  if (typeof err === "string") return err || "An error occurred"
  
  // Check for Error instance
  if (err instanceof Error) {
    return err.message || err.name || "An error occurred"
  }
  
  // Check for object with message property (Supabase AuthApiError)
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>
    
    // Try common error properties in order of preference
    if (typeof obj.message === "string" && obj.message) return obj.message
    if (typeof obj.error_description === "string" && obj.error_description) return obj.error_description
    if (typeof obj.error === "string" && obj.error) return obj.error
    if (typeof obj.msg === "string" && obj.msg) return obj.msg
    if (typeof obj.name === "string" && obj.name) return obj.name
    if (typeof obj.code === "string" && obj.code) return `Error code: ${obj.code}`
    
    // Try to stringify but avoid showing {}
    try {
      const str = JSON.stringify(err)
      if (str && str !== "{}" && str !== "null" && str !== "undefined" && str.length > 2) {
        return str.length > 100 ? str.substring(0, 100) + "..." : str
      }
    } catch {
      // Ignore stringify errors
    }
  }
  
  return "An error occurred. Please try again."
}

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

    console.log("[v0] handleLogin started", { email })
    console.log("[v0] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL)

    try {
      const supabase = createClient()
      console.log("[v0] Supabase client created successfully")

      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      
      console.log("[v0] signInWithPassword completed")
      console.log("[v0] data:", JSON.stringify(data, null, 2))
      console.log("[v0] authError:", authError ? JSON.stringify(authError, null, 2) : "none")

      if (authError) {
        const errorMsg = getErrorMessage(authError)
        console.log("[v0] Extracted error message:", errorMsg)
        setError(errorMsg)
        setIsLoading(false)
        return
      }

      if (!data?.user) {
        console.log("[v0] No user in response data")
        setError("Sign in failed - no user data returned")
        setIsLoading(false)
        return
      }

      console.log("[v0] Login successful for user:", data.user.email)
      document.cookie = `planck_session=active; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Strict`
      sessionStorage.setItem("planck_nav_source", "auth")
      router.push("/qsaas/dashboard")
    } catch (err: unknown) {
      console.log("[v0] Login CATCH block - raw error:", err)
      console.log("[v0] Error type:", typeof err)
      console.log("[v0] Error constructor:", err?.constructor?.name)
      const errorMsg = getErrorMessage(err)
      console.log("[v0] Extracted catch error message:", errorMsg)
      setError(errorMsg)
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
            {error && typeof error === "string" && error.length > 0 && error !== "{}" && (
              <p className="text-sm text-destructive">{error}</p>
            )}
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
