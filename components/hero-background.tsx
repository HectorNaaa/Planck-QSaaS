"use client"

import { useEffect, useRef } from "react"

// Site primary teal: #578e7e  →  rgb(87, 142, 126)
const T = "87, 142, 126"

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrgNode {
  bx: number; by: number
  x: number;  y: number
  r: number
  px: number; py: number
  fx: number; fy: number
  ax: number; ay: number
}

interface StructNode {
  bx: number; by: number
  x: number;  y: number
  r: number
  px: number; py: number
  fx: number; fy: number
}

interface FlowParticle {
  t: number       // bezier progress 0‥1
  spd: number
  ctrlY: number   // per-particle bezier control-point Y
  op: number
  sz: number
  isBit: boolean  // render "0"/"1" glyph instead of circle
  bit: string
  reverse: boolean // true = right→left feedback path
}

// ─── Component ────────────────────────────────────────────────────────────────
/**
 * HeroBackground — Canvas animation: physical cluster → binary data stream →
 * quantum/AI processing core → structured digital twin → feedback to physical.
 *
 * Sizing fix: uses getBoundingClientRect() of the parent element with a
 * double-rAF delay so layout is guaranteed to be complete before we read
 * dimensions. Falls back to window dimensions. Uses window resize listener.
 */
export function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return

    let raf  = 0
    let tick = 0
    let W = 0, H = 0, cx = 0, cy = 0

    let ON: OrgNode[]      = []
    let SN: StructNode[]   = []
    let FP: FlowParticle[] = []
    let BP: FlowParticle[] = []

    // ── Reliable dimension reading ────────────────────────────────────────────
    // Use the parent's bounding rect (absolute inset-0 fills the canvas-host div).
    // Always use window.innerWidth so the canvas covers the full viewport width.
    const readSize = (): { w: number; h: number } => {
      const w = window.innerWidth
      const parent = canvas.parentElement
      if (parent) {
        const r = parent.getBoundingClientRect()
        if (r.height > 0) return { w, h: r.height }
      }
      // Walk up to find the hero section by data attribute
      let el: HTMLElement | null = canvas
      while (el && !(el as any).dataset?.hnHero) el = el.parentElement
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.height > 0) return { w, h: r.height }
      }
      return { w, h: Math.max(520, window.innerHeight * 0.75) }
    }

    // ── Setup ─────────────────────────────────────────────────────────────────
    const setup = () => {
      const { w, h } = readSize()
      W = w; H = h
      canvas.width  = W
      canvas.height = H
      cx = W * 0.5
      cy = H * 0.5

      // Scale particle/node density with viewport — more nodes on larger screens
      const sm = W < 640
      const lg = W >= 1280
      const nc = sm ? 12 : lg ? 28 : 20
      const nf = sm ? 10 : lg ? 24 : 18
      const nb = sm ?  5 : lg ? 12 :  9

      // LEFT — organic/physical cluster
      ON = Array.from({ length: nc }, () => {
        const bx = W * 0.03 + Math.random() * W * 0.22
        const by = H * 0.12 + Math.random() * H * 0.76
        return {
          bx, by, x: bx, y: by,
          r:  4 + Math.random() * 5,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          fx: 0.004 + Math.random() * 0.005,
          fy: 0.003 + Math.random() * 0.005,
          ax: 20 + Math.random() * 16,
          ay: 14 + Math.random() * 12,
        }
      })

      // RIGHT — structured digital-twin grid
      const cols = sm ? 3 : 4
      const rows = Math.ceil(nc / cols)
      const gw   = W * 0.22
      const gh   = H * 0.62
      const sx   = W * 0.71
      const sy   = H * 0.19

      SN = Array.from({ length: nc }, (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const bx  = sx + (cols > 1 ? col / (cols - 1) : 0.5) * gw + (Math.random() - 0.5) * 6
        const by  = sy + (rows > 1 ? row / (rows - 1) : 0.5) * gh + (Math.random() - 0.5) * 6
        return {
          bx, by, x: bx, y: by,
          r:  3 + Math.random() * 3,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          fx: 0.0008 + Math.random() * 0.001,
          fy: 0.0008 + Math.random() * 0.001,
        }
      })

      // Forward particles: arcs above centre
      FP = Array.from({ length: nf }, (_, i) => {
        const isBit = i % 3 === 0
        return {
          t:     i / nf,
          spd:   0.003 + Math.random() * 0.002,
          ctrlY: cy - (H * 0.08 + Math.random() * H * 0.12),
          op:    0.80 + Math.random() * 0.18,
          sz:    isBit ? 14 + Math.random() * 5 : 3 + Math.random() * 2.5,
          isBit,
          bit:   Math.random() < 0.5 ? "0" : "1",
          reverse: false,
        }
      })

      // Feedback particles: arcs below centre
      BP = Array.from({ length: nb }, (_, i) => {
        const isBit = i % 2 === 0
        return {
          t:     i / nb,
          spd:   0.0025 + Math.random() * 0.0018,
          ctrlY: cy + (H * 0.07 + Math.random() * H * 0.09),
          op:    0.58 + Math.random() * 0.28,
          sz:    isBit ? 11 + Math.random() * 4 : 2.5 + Math.random() * 2,
          isBit,
          bit:   Math.random() < 0.5 ? "0" : "1",
          reverse: true,
        }
      })

      tick = 0
    }

    // ── Draw frame ────────────────────────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      tick++

      for (const n of ON) {
        n.x = n.bx + Math.sin(tick * n.fx + n.px) * n.ax
        n.y = n.by + Math.sin(tick * n.fy + n.py) * n.ay
      }
      for (const n of SN) {
        n.x = n.bx + Math.sin(tick * n.fx + n.px) * 5
        n.y = n.by + Math.sin(tick * n.fy + n.py) * 5
      }

      let lx = 0, ly = 0, rx = 0, ry = 0
      for (const n of ON) { lx += n.x; ly += n.y }
      for (const n of SN) { rx += n.x; ry += n.y }
      lx /= ON.length; ly /= ON.length
      rx /= SN.length; ry /= SN.length

      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.022)

      // ── Left organic connections ────────────────────────────────────────────
      const ldmax = W * 0.22
      ctx.lineWidth = 2
      for (let i = 0; i < ON.length; i++) {
        for (let j = i + 1; j < ON.length; j++) {
          const dx = ON[i].x - ON[j].x
          const dy = ON[i].y - ON[j].y
          const d  = Math.hypot(dx, dy)
          if (d < ldmax) {
            ctx.strokeStyle = `rgba(${T}, ${(1 - d / ldmax) * 0.80})`
            ctx.beginPath()
            ctx.moveTo(ON[i].x, ON[i].y)
            ctx.lineTo(ON[j].x, ON[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Right grid connections ──────────────────────────────────────────────
      const rdmax = W * 0.18
      ctx.lineWidth = 1.8
      for (let i = 0; i < SN.length; i++) {
        for (let j = i + 1; j < SN.length; j++) {
          const dx = SN[i].x - SN[j].x
          const dy = SN[i].y - SN[j].y
          const d  = Math.hypot(dx, dy)
          if (d < rdmax) {
            ctx.strokeStyle = `rgba(${T}, ${(1 - d / rdmax) * 0.85})`
            ctx.beginPath()
            ctx.moveTo(SN[i].x, SN[i].y)
            ctx.lineTo(SN[j].x, SN[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Forward bridge: left → right (solid, upper arc) ────────────────────
      const fwdCtrlY = cy - H * 0.10
      ctx.setLineDash([])
      ctx.lineWidth = 3
      ctx.strokeStyle = `rgba(${T}, ${0.70 + pulse * 0.18})`
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.quadraticCurveTo(cx, fwdCtrlY, rx, ry)
      ctx.stroke()

      // ── Feedback bridge: right → left (dashed, lower arc) ──────────────────
      const fbkCtrlY = cy + H * 0.10
      ctx.lineWidth = 2
      ctx.strokeStyle = `rgba(${T}, ${0.48 + pulse * 0.14})`
      ctx.setLineDash([6, 8])
      ctx.beginPath()
      ctx.moveTo(rx, ry)
      ctx.quadraticCurveTo(cx, fbkCtrlY, lx, ly)
      ctx.stroke()
      ctx.setLineDash([])

      // ── Quantum/AI processing core ──────────────────────────────────────────
      const cr = 70 + pulse * 28
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr)
      grd.addColorStop(0,   `rgba(${T}, ${0.72 + pulse * 0.22})`)
      grd.addColorStop(0.35,`rgba(${T}, ${0.30 + pulse * 0.12})`)
      grd.addColorStop(1,   `rgba(${T}, 0)`)
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()

      // Inner ring
      ctx.lineWidth = 2.5
      ctx.strokeStyle = `rgba(${T}, ${0.70 + pulse * 0.22})`
      ctx.beginPath()
      ctx.arc(cx, cy, 20 + pulse * 7, 0, Math.PI * 2)
      ctx.stroke()

      // Outer ring
      ctx.lineWidth = 1.5
      ctx.strokeStyle = `rgba(${T}, ${0.42 + pulse * 0.15})`
      ctx.beginPath()
      ctx.arc(cx, cy, 40 + pulse * 12, 0, Math.PI * 2)
      ctx.stroke()

      // Centre dot
      ctx.fillStyle = `rgba(${T}, ${0.95 + pulse * 0.05})`
      ctx.beginPath()
      ctx.arc(cx, cy, 7, 0, Math.PI * 2)
      ctx.fill()

      // ── Forward flow particles (left → right) ───────────────────────────────
      for (const p of FP) {
        p.t += p.spd
        if (p.t > 1) { p.t -= 1; p.bit = Math.random() < 0.5 ? "0" : "1" }

        const mt   = 1 - p.t
        const bx   = mt * mt * lx + 2 * mt * p.t * cx + p.t * p.t * rx
        const by   = mt * mt * ly + 2 * mt * p.t * p.ctrlY + p.t * p.t * ry
        const fade = Math.min(p.t * 4, (1 - p.t) * 4, 1)
        const a    = p.op * fade

        if (p.isBit) {
          ctx.save()
          ctx.font = `bold ${Math.round(p.sz)}px monospace`
          ctx.fillStyle = `rgba(${T}, ${a})`
          ctx.fillText(p.bit, bx - p.sz * 0.30, by + p.sz * 0.38)
          ctx.restore()
        } else {
          ctx.fillStyle = `rgba(${T}, ${a})`
          ctx.beginPath()
          ctx.arc(bx, by, p.sz, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Feedback particles (right → left) ──────────────────────────────────
      for (const p of BP) {
        p.t += p.spd
        if (p.t > 1) { p.t -= 1; p.bit = Math.random() < 0.5 ? "0" : "1" }

        const mt   = 1 - p.t
        const bx   = mt * mt * rx + 2 * mt * p.t * cx + p.t * p.t * lx
        const by   = mt * mt * ry + 2 * mt * p.t * p.ctrlY + p.t * p.t * ly
        const fade = Math.min(p.t * 4, (1 - p.t) * 4, 1)
        const a    = p.op * fade

        if (p.isBit) {
          ctx.save()
          ctx.font = `bold ${Math.round(p.sz)}px monospace`
          ctx.fillStyle = `rgba(${T}, ${a})`
          ctx.fillText(p.bit, bx - p.sz * 0.30, by + p.sz * 0.38)
          ctx.restore()
        } else {
          ctx.fillStyle = `rgba(${T}, ${a})`
          ctx.beginPath()
          ctx.arc(bx, by, p.sz, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Left organic nodes ──────────────────────────────────────────────────
      ctx.fillStyle = `rgba(${T}, 0.95)`
      for (const n of ON) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Right structured nodes ──────────────────────────────────────────────
      ctx.fillStyle = `rgba(${T}, 0.92)`
      for (const n of SN) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    // Start with double-rAF to guarantee layout is flushed before we read sizes
    const start = () => {
      setup()
      draw()
    }
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(start)
    })

    // ResizeObserver: re-setup whenever the parent container resizes
    // (handles cases where double-rAF fires before layout is finalised)
    let roTimer = 0
    const ro = new ResizeObserver(() => {
      clearTimeout(roTimer)
      roTimer = window.setTimeout(() => {
        cancelAnimationFrame(raf)
        setup()
        draw()
      }, 60)
    })
    const parent = canvas.parentElement
    if (parent) ro.observe(parent)

    // Window resize listener (covers viewport changes not caught by RO)
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setup()
        draw()
      })
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(roTimer)
      ro.disconnect()
      window.removeEventListener("resize", onResize)
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
