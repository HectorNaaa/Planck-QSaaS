"use client"

import type React from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSelector } from "@/components/language-selector"
import Image from "next/image"
import Link from "next/link"
import {
  verifyCode as checkVerificationCode,
  sendVerificationEmail,
  sendVerificationSMS,
} from "@/lib/verification-service"

export default function VerifyCodePage() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email")
  const phone = searchParams.get("phone")
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [verificationMethod, setVerificationMethod] = useState<"email" | "sms">("email")
  const router = useRouter()

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
      const isValid = checkVerificationCode(code, email)

      if (!isValid) {
        setError("Invalid or expired verification code")
        setIsLoading(false)
        return
      }

      // Code is valid, redirect to dashboard
      router.push("/qsaas/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Verification failed")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async (method: "email" | "sms") => {
    if (!email) return

    setResendLoading(true)
    setError(null)

    try {
      if (method === "email") {
        await sendVerificationEmail(email)
      } else if (method === "sms" && phone) {
        await sendVerificationSMS(phone, email)
      }

      setVerificationMethod(method)
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
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Verify Your Account</CardTitle>
          <CardDescription>
            {verificationMethod === "email"
              ? "Enter the verification code sent to your email"
              : "Enter the verification code sent via SMS"}
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

          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground text-center">Didn't receive the code?</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-border bg-transparent"
                onClick={() => handleResendCode("email")}
                disabled={resendLoading || resendCountdown > 0}
              >
                {resendCountdown > 0 && verificationMethod === "email"
                  ? `Resend in ${resendCountdown}s`
                  : resendLoading
                    ? "Sending..."
                    : "Resend via Email"}
              </Button>
              {phone && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border bg-transparent"
                  onClick={() => handleResendCode("sms")}
                  disabled={resendLoading || resendCountdown > 0}
                >
                  {resendCountdown > 0 && verificationMethod === "sms"
                    ? `Resend in ${resendCountdown}s`
                    : resendLoading
                      ? "Sending..."
                      : "Resend via SMS"}
                </Button>
              )}
            </div>
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
