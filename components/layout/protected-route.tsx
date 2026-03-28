"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
}

export function ProtectedRoute({ children, requireAuth = false }: ProtectedRouteProps) {
  // In a real app, check authentication status here
  const isAuthenticated = true

  if (requireAuth && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold text-foreground mb-4">Access Required</h1>
          <p className="text-muted-foreground mb-8">You need to be logged in to access this page.</p>
          <Link href="/">
            <Button className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2">
              Go to Home <ArrowRight size={18} />
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
