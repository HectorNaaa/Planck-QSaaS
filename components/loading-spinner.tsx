"use client"

export function LoadingSpinner({ size = "default" }: { size?: "sm" | "default" }) {
  if (size === "sm") {
    return (
      <div className="relative w-4 h-4">
        <div className="absolute inset-0 rounded-full border-2 border-secondary"></div>
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-secondary"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
        </div>
      </div>
    </div>
  )
}
