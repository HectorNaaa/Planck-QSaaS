"use client"

import { useEffect, useRef } from "react"

export function Sparkles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    interface Sparkle {
      x: number
      y: number
      size: number
      opacity: number
      vx: number
      vy: number
      life: number
      maxLife: number
    }

    const sparkles: Sparkle[] = []

    const createSparkle = (x: number, y: number) => {
      sparkles.push({
        x,
        y,
        size: Math.random() * 2 + 1,
        opacity: 1,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: Math.random() * 60 + 60,
      })
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Create new sparkles randomly
      if (Math.random() < 0.3) {
        createSparkle(Math.random() * canvas.width, Math.random() * canvas.height * 0.5)
      }

      // Update and draw sparkles
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sparkle = sparkles[i]
        sparkle.life++
        sparkle.opacity = 1 - sparkle.life / sparkle.maxLife

        if (sparkle.opacity <= 0) {
          sparkles.splice(i, 1)
          continue
        }

        sparkle.x += sparkle.vx
        sparkle.y += sparkle.vy

        ctx.fillStyle = `rgba(87, 142, 126, ${sparkle.opacity * 0.7})`
        ctx.beginPath()
        ctx.arc(sparkle.x, sparkle.y, sparkle.size, 0, Math.PI * 2)
        ctx.fill()
      }

      requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
}
