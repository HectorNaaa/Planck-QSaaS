'use client'

import { useEffect, useRef } from 'react'

export function TitleAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.offsetWidth
        canvas.height = parent.offsetHeight
      }
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Wave animation with turquoise color
    let animationFrame: number
    let phase = 0

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw flowing waves
      const waves = 3
      for (let w = 0; w < waves; w++) {
        ctx.beginPath()
        const amplitude = 30 + w * 10
        const frequency = 0.01 + w * 0.005
        const phaseShift = (w * Math.PI) / 2

        for (let x = 0; x < canvas.width; x++) {
          const y = 
            canvas.height / 2 + 
            Math.sin(x * frequency + phase + phaseShift) * amplitude
          
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }

        const opacity = 0.15 - w * 0.03
        ctx.strokeStyle = `rgba(87, 142, 126, ${opacity})`
        ctx.lineWidth = 2 + w
        ctx.stroke()
      }

      phase += 0.02
      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrame)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.4 }}
    />
  )
}
