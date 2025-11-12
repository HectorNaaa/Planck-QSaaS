"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { CheckCircle } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="w-full max-w-md px-4">
      <Card className="border-border text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Account Created!</CardTitle>
          <CardDescription className="text-base">Please check your email to confirm your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We've sent a confirmation link to your email. Click it to activate your account and start using Planck.
          </p>
          <Link href="/auth/login" className="block">
            <Button className="w-full bg-primary hover:bg-primary/90">Back to Sign In</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
