"use client"

import { useEffect, useRef } from "react"

// Site primary teal: #578e7e  →  rgb(87, 142, 126)
const T = "87, 142, 126"

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgNode {
  bx: number; by: number          // base position (static)
  x: number;  y: number           // current position (animated)
  r: number                       // radius
  px: number; py: number          // phase offset
  fx: number; fy: number          // frequency
  ax: number; ay: number          // amplitude
}

interface StructNode {
  bx: number; by: number
  x: number;  y: number
  r: number
  px: number; py: number
  fx: number; fy: number
}

interface FlowDot {
  t: number     // progress along bezier path 0‥1
  spd: number   // speed per frame
  arc: number   // vertical arc offset at midpoint
  op: number    // base opacity
  sz: number    // radius
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * HeroBackground — Canvas animation visualising the real-world system →
 * quantum processing core → optimised digital model transformation.
 *
 * Performance: single rAF loop, ResizeObserver, reduced-motion aware,
 * proper cancelAnimationFrame cleanup, no heavy dependencies.
 */
export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Respect user's motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let raf         = 0
    let tick        = 0
    let W           = 0
    let H           = 0
    let cx          = 0   // canvas centre x
    let cy          = 0   // canvas centre y

    let ON: OrgNode[]    = []   // left  — organic/physical nodes
    let SN: StructNode[] = []   // right — structured/model nodes
    let FD: FlowDot[]    = []   // flow particles

    // ── Initialise / reinitialise on resize ───────────────────────────────────
    const setup = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width  = W
      canvas.height = H
      cx = W * 0.5
      cy = H * 0.5

      const sm = W < 640
      const nc = sm ? 10 : 16   // node count (same for both sides)
      const fc = sm ? 6  : 10   // flow-dot count

      // LEFT — organic cluster (physical system): chaotic, organic motion
      ON = Array.from({ length: nc }, () => {
        const bx = W * 0.04 + Math.random() * W * 0.22
        const by = H * 0.18 + Math.random() * H * 0.64
        return {
          bx, by, x: bx, y: by,
          r:  1.5 + Math.random() * 1.5,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          fx: 0.004 + Math.random() * 0.004,   // faster oscillation
          fy: 0.003 + Math.random() * 0.004,
          ax: 18 + Math.random() * 14,           // larger amplitude
          ay: 12 + Math.random() * 10,
        }
      })

      // RIGHT — structured grid (digital model): stable, minimal drift
      const cols  = sm ? 3 : 4
      const rows  = Math.ceil(nc / cols)
      const gw    = W * 0.22
      const gh    = H * 0.55
      const sx    = W * 0.70
      const sy    = H * 0.225

      SN = Array.from({ length: nc }, (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const bx  = sx + (cols > 1 ? col / (cols - 1) : 0.5) * gw + (Math.random() - 0.5) * 12
        const by  = sy + (rows > 1 ? row / (rows - 1) : 0.5) * gh + (Math.random() - 0.5) * 10
        return {
          bx, by, x: bx, y: by,
          r:  1.5 + Math.random(),
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          fx: 0.001 + Math.random() * 0.001,    // very slow — structured calm
          fy: 0.001 + Math.random() * 0.001,
        }
      })

      // FLOW DOTS — stream along bezier from left cluster → core → right cluster
      FD = Array.from({ length: fc }, (_, i) => ({
        t:   i / fc,                                   // staggered start
        spd: 0.003 + Math.random() * 0.002,
        arc: (Math.random() - 0.5) * H * 0.12,        // vertical arc height
        op:  0.40 + Math.random() * 0.40,
        sz:  1.5  + Math.random(),
      }))

      tick = 0
    }

    // ── One draw frame ────────────────────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      tick++

      // Animate positions
      for (const n of ON) {
        n.x = n.bx + Math.sin(tick * n.fx + n.px) * n.ax
        n.y = n.by + Math.sin(tick * n.fy + n.py) * n.ay
      }
      for (const n of SN) {
        n.x = n.bx + Math.sin(tick * n.fx + n.px) * 6
        n.y = n.by + Math.sin(tick * n.fy + n.py) * 6
      }

      // Live centroids (used for bridge path + flow dots)
      const len  = ON.length
      let lx = 0, ly = 0, rx = 0, ry = 0
      for (const n of ON) { lx += n.x; ly += n.y }
      for (const n of SN) { rx += n.x; ry += n.y }
      lx /= len; ly /= len; rx /= len; ry /= len

      // Slow global pulse driving the core glow + bridge opacity
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.022)

      // ── Left network connections ────────────────────────────────────────────
      const ldmax = W * 0.18
      ctx.lineWidth = 0.6
      for (let i = 0; i < ON.length; i++) {
        for (let j = i + 1; j < ON.length; j++) {
          const dx = ON[i].x - ON[j].x
          const dy = ON[i].y - ON[j].y
          const d  = Math.hypot(dx, dy)
          if (d < ldmax) {
            ctx.strokeStyle = `rgba(${T}, ${(1 - d / ldmax) * 0.20})`
            ctx.beginPath()
            ctx.moveTo(ON[i].x, ON[i].y)
            ctx.lineTo(ON[j].x, ON[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Right network connections ───────────────────────────────────────────
      const rdmax = W * 0.14
      for (let i = 0; i < SN.length; i++) {
        for (let j = i + 1; j < SN.length; j++) {
          const dx = SN[i].x - SN[j].x
          const dy = SN[i].y - SN[j].y
          const d  = Math.hypot(dx, dy)
          if (d < rdmax) {
            ctx.strokeStyle = `rgba(${T}, ${(1 - d / rdmax) * 0.24})`
            ctx.beginPath()
            ctx.moveTo(SN[i].x, SN[i].y)
            ctx.lineTo(SN[j].x, SN[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Bridge bezier (left centroid → processing core → right centroid) ────
      ctx.lineWidth = 1
      ctx.strokeStyle = `rgba(${T}, ${0.07 + pulse * 0.04})`
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.quadraticCurveTo(cx, cy, rx, ry)
      ctx.stroke()

      // ── Processing core glow ────────────────────────────────────────────────
      const cr = 28 + pulse * 12
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr)
      g.addColorStop(0, `rgba(${T}, ${0.12 + pulse * 0.06})`)
      g.addColorStop(1, `rgba(${T}, 0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()

      // Core anchor dot
      ctx.fillStyle = `rgba(${T}, ${0.38 + pulse * 0.22})`
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fill()

      // ── Flow dots along bridge bezier ───────────────────────────────────────
      for (const d of FD) {
        d.t += d.spd
        if (d.t > 1) d.t -= 1

        // Quadratic bezier: left → (centre + arc) → right
        const mt = 1 - d.t
        const px  = mt * mt * lx + 2 * mt * d.t * cx           + d.t * d.t * rx
        const py  = mt * mt * ly + 2 * mt * d.t * (cy + d.arc) + d.t * d.t * ry

        // Fade in/out at path ends
        const fade = Math.min(d.t * 6, (1 - d.t) * 6, 1)
        ctx.fillStyle = `rgba(${T}, ${d.op * fade})`
        ctx.beginPath()
        ctx.arc(px, py, d.sz, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Left nodes (organic dots) ───────────────────────────────────────────
      ctx.fillStyle = `rgba(${T}, 0.55)`
      for (const n of ON) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Right nodes (structured dots, slightly crisper opacity) ────────────
      ctx.fillStyle = `rgba(${T}, 0.50)`
      for (const n of SN) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    // ResizeObserver keeps canvas pixel-size in sync with layout size
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      setup()
      raf = requestAnimationFrame(draw)
    })
    ro.observe(canvas)

    setup()
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  )
}
