"use client"

import type React from "react"

import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/loading-spinner"

export default function VerifyCodePage() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")
  const phone = searchParams.get("phone")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCountdown])

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!email) {
      setError("Email not found")
      setIsLoading(false)
      return
    }

    try {
      // In production, this would verify the code against the database
      // For now, we'll simulate verification
      const { data: verificationData, error: verifyError } = await supabase
        .from("verification_codes")
        .select("*")
        .eq("email", email)
        .eq("code", code)
        .gt("expires_at", new Date().toISOString())
        .single()

      if (verifyError || !verificationData) {
        setError("Invalid or expired code")
        setIsLoading(false)
        return
      }

      // Mark as verified
      await supabase
        .from("verification_codes")
        .update({ verified_at: new Date().toISOString() })
        .eq("id", verificationData.id)

      // Update profile
      const user = (await supabase.auth.getUser()).data.user
      if (user) {
        await supabase.from("profiles").update({ email_verified: true }).eq("id", user.id)
      }

      router.push("/qsaas/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!email) return

    setResendLoading(true)
    setError(null)

    try {
      // In production, this would call a server action to resend via email or SMS
      console.log("Resending code to", phone ? `SMS: ${phone}` : `Email: ${email}`)

      setResendCountdown(60)
      setError(null)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to resend code")
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md px-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            {phone
              ? "We sent a code to your email. If you don't receive it, we'll send it via SMS."
              : "Enter the verification code sent to your email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="000000"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={isLoading}
                className="bg-input border-border text-center text-2xl tracking-widest"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Verifying...
                </div>
              ) : (
                "Verify Code"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">Didn't receive the code?</p>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-transparent"
              onClick={handleResendCode}
              disabled={resendLoading || resendCountdown > 0}
            >
              {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : resendLoading ? "Sending..." : "Resend Code"}
            </Button>
          </div>

          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              {phone ? (
                <>
                  Email: {email}
                  <br />
                  Phone: {phone}
                </>
              ) : (
                `Email: ${email}`
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
