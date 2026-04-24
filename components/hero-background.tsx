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
 * Performance: single rAF loop, ResizeObserver, prefers-reduced-motion aware,
 * no external dependencies.
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

    let ON: OrgNode[]      = []   // left  — organic/physical nodes
    let SN: StructNode[]   = []   // right — structured digital-twin nodes
    let FP: FlowParticle[] = []   // forward  particles left→right
    let BP: FlowParticle[] = []   // feedback particles right→left

    // ── Initialise / reinitialise on resize ───────────────────────────────────
    const setup = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width  = W
      canvas.height = H
      cx = W * 0.5
      cy = H * 0.5

      const sm = W < 640
      const nc = sm ? 10 : 18   // nodes per side
      const nf = sm ?  9 : 16   // forward  particles
      const nb = sm ?  4 :  8   // feedback particles

      // LEFT — organic/physical cluster: larger, more chaotic
      ON = Array.from({ length: nc }, () => {
        const bx = W * 0.03 + Math.random() * W * 0.22
        const by = H * 0.15 + Math.random() * H * 0.70
        return {
          bx, by, x: bx, y: by,
          r:  2.5 + Math.random() * 3,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          fx: 0.004 + Math.random() * 0.005,
          fy: 0.003 + Math.random() * 0.005,
          ax: 20 + Math.random() * 16,
          ay: 14 + Math.random() * 12,
        }
      })

      // RIGHT — structured grid/digital twin: calm, minimal drift
      const cols = sm ? 3 : 4
      const rows = Math.ceil(nc / cols)
      const gw   = W * 0.22
      const gh   = H * 0.58
      const sx   = W * 0.71
      const sy   = H * 0.21

      SN = Array.from({ length: nc }, (_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const bx  = sx + (cols > 1 ? col / (cols - 1) : 0.5) * gw + (Math.random() - 0.5) * 8
        const by  = sy + (rows > 1 ? row / (rows - 1) : 0.5) * gh + (Math.random() - 0.5) * 8
        return {
          bx, by, x: bx, y: by,
          r:  2 + Math.random() * 2,
          px: Math.random() * Math.PI * 2,
          py: Math.random() * Math.PI * 2,
          fx: 0.0008 + Math.random() * 0.001,
          fy: 0.0008 + Math.random() * 0.001,
        }
      })

      // Forward particles: arcs above centre (data flowing to digital twin)
      FP = Array.from({ length: nf }, (_, i) => {
        const isBit = i % 3 === 0
        return {
          t:     i / nf,
          spd:   0.0028 + Math.random() * 0.0022,
          ctrlY: cy - (H * 0.07 + Math.random() * H * 0.10),
          op:    0.62 + Math.random() * 0.28,
          sz:    isBit ? 8 + Math.random() * 4 : 2.2 + Math.random() * 1.8,
          isBit,
          bit:   Math.random() < 0.5 ? "0" : "1",
          reverse: false,
        }
      })

      // Feedback particles: arcs below centre (twin insights back to physical)
      BP = Array.from({ length: nb }, (_, i) => {
        const isBit = i % 2 === 0
        return {
          t:     i / nb,
          spd:   0.0020 + Math.random() * 0.0018,
          ctrlY: cy + (H * 0.06 + Math.random() * H * 0.08),
          op:    0.45 + Math.random() * 0.25,
          sz:    isBit ? 6.5 + Math.random() * 3 : 1.8 + Math.random() * 1.2,
          isBit,
          bit:   Math.random() < 0.5 ? "0" : "1",
          reverse: true,
        }
      })

      tick = 0
    }

    // ── Frame draw ────────────────────────────────────────────────────────────
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      tick++

      // Animate positions
      for (const n of ON) {
        n.x = n.bx + Math.sin(tick * n.fx + n.px) * n.ax
        n.y = n.by + Math.sin(tick * n.fy + n.py) * n.ay
      }
      for (const n of SN) {
        n.x = n.bx + Math.sin(tick * n.fx + n.px) * 5
        n.y = n.by + Math.sin(tick * n.fy + n.py) * 5
      }

      // Centroids — anchor points for bezier bridges
      let lx = 0, ly = 0, rx = 0, ry = 0
      for (const n of ON) { lx += n.x; ly += n.y }
      for (const n of SN) { rx += n.x; ry += n.y }
      lx /= ON.length; ly /= ON.length
      rx /= SN.length; ry /= SN.length

      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.022)

      // ── Left organic connections ────────────────────────────────────────────
      const ldmax = W * 0.20
      ctx.lineWidth = 1.0
      for (let i = 0; i < ON.length; i++) {
        for (let j = i + 1; j < ON.length; j++) {
          const dx = ON[i].x - ON[j].x
          const dy = ON[i].y - ON[j].y
          const d  = Math.hypot(dx, dy)
          if (d < ldmax) {
            ctx.strokeStyle = `rgba(${T}, ${(1 - d / ldmax) * 0.40})`
            ctx.beginPath()
            ctx.moveTo(ON[i].x, ON[i].y)
            ctx.lineTo(ON[j].x, ON[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Right grid connections ──────────────────────────────────────────────
      const rdmax = W * 0.16
      ctx.lineWidth = 0.9
      for (let i = 0; i < SN.length; i++) {
        for (let j = i + 1; j < SN.length; j++) {
          const dx = SN[i].x - SN[j].x
          const dy = SN[i].y - SN[j].y
          const d  = Math.hypot(dx, dy)
          if (d < rdmax) {
            ctx.strokeStyle = `rgba(${T}, ${(1 - d / rdmax) * 0.44})`
            ctx.beginPath()
            ctx.moveTo(SN[i].x, SN[i].y)
            ctx.lineTo(SN[j].x, SN[j].y)
            ctx.stroke()
          }
        }
      }

      // ── Forward bridge — left →  right (solid), arcs above centre ──────────
      const fwdCtrlY = cy - H * 0.09
      ctx.setLineDash([])
      ctx.lineWidth = 1.4
      ctx.strokeStyle = `rgba(${T}, ${0.22 + pulse * 0.10})`
      ctx.beginPath()
      ctx.moveTo(lx, ly)
      ctx.quadraticCurveTo(cx, fwdCtrlY, rx, ry)
      ctx.stroke()

      // ── Feedback bridge — right → left (dashed), arcs below centre ─────────
      const fbkCtrlY = cy + H * 0.09
      ctx.lineWidth = 0.9
      ctx.strokeStyle = `rgba(${T}, ${0.15 + pulse * 0.07})`
      ctx.setLineDash([5, 8])
      ctx.beginPath()
      ctx.moveTo(rx, ry)
      ctx.quadraticCurveTo(cx, fbkCtrlY, lx, ly)
      ctx.stroke()
      ctx.setLineDash([])

      // ── Quantum/AI processing core ──────────────────────────────────────────
      // Outer glow
      const cr = 44 + pulse * 18
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr)
      grd.addColorStop(0,   `rgba(${T}, ${0.34 + pulse * 0.14})`)
      grd.addColorStop(0.4, `rgba(${T}, ${0.14 + pulse * 0.08})`)
      grd.addColorStop(1,   `rgba(${T}, 0)`)
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()

      // Inner ring
      ctx.lineWidth = 1.1
      ctx.strokeStyle = `rgba(${T}, ${0.28 + pulse * 0.14})`
      ctx.beginPath()
      ctx.arc(cx, cy, 16 + pulse * 5, 0, Math.PI * 2)
      ctx.stroke()

      // Outer ring
      ctx.lineWidth = 0.6
      ctx.strokeStyle = `rgba(${T}, ${0.16 + pulse * 0.08})`
      ctx.beginPath()
      ctx.arc(cx, cy, 30 + pulse * 8, 0, Math.PI * 2)
      ctx.stroke()

      // Centre dot
      ctx.fillStyle = `rgba(${T}, ${0.72 + pulse * 0.24})`
      ctx.beginPath()
      ctx.arc(cx, cy, 4, 0, Math.PI * 2)
      ctx.fill()

      // ── Forward flow particles (left → right, data bits) ───────────────────
      for (const p of FP) {
        p.t += p.spd
        if (p.t > 1) {
          p.t -= 1
          p.bit = Math.random() < 0.5 ? "0" : "1"
        }
        const mt   = 1 - p.t
        const bx   = mt * mt * lx + 2 * mt * p.t * cx + p.t * p.t * rx
        const by   = mt * mt * ly + 2 * mt * p.t * p.ctrlY + p.t * p.t * ry
        const fade = Math.min(p.t * 5, (1 - p.t) * 5, 1)
        const a    = p.op * fade

        if (p.isBit) {
          ctx.save()
          ctx.font = `bold ${Math.round(p.sz)}px monospace`
          ctx.fillStyle = `rgba(${T}, ${a * 0.92})`
          ctx.fillText(p.bit, bx - p.sz * 0.30, by + p.sz * 0.36)
          ctx.restore()
        } else {
          ctx.fillStyle = `rgba(${T}, ${a})`
          ctx.beginPath()
          ctx.arc(bx, by, p.sz, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Feedback particles (right → left, insights returning) ──────────────
      for (const p of BP) {
        p.t += p.spd
        if (p.t > 1) {
          p.t -= 1
          p.bit = Math.random() < 0.5 ? "0" : "1"
        }
        // Reversed: start=rx,ry  end=lx,ly
        const mt   = 1 - p.t
        const bx   = mt * mt * rx + 2 * mt * p.t * cx + p.t * p.t * lx
        const by   = mt * mt * ry + 2 * mt * p.t * p.ctrlY + p.t * p.t * ly
        const fade = Math.min(p.t * 5, (1 - p.t) * 5, 1)
        const a    = p.op * fade

        if (p.isBit) {
          ctx.save()
          ctx.font = `bold ${Math.round(p.sz)}px monospace`
          ctx.fillStyle = `rgba(${T}, ${a * 0.88})`
          ctx.fillText(p.bit, bx - p.sz * 0.30, by + p.sz * 0.36)
          ctx.restore()
        } else {
          ctx.fillStyle = `rgba(${T}, ${a})`
          ctx.beginPath()
          ctx.arc(bx, by, p.sz, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Left organic nodes ──────────────────────────────────────────────────
      for (const n of ON) {
        ctx.fillStyle = `rgba(${T}, 0.70)`
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Right structured nodes ──────────────────────────────────────────────
      for (const n of SN) {
        ctx.fillStyle = `rgba(${T}, 0.65)`
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
