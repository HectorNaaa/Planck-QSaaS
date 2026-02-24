"use client"

// Three green tones used throughout: bright #4ade80, mid #22c55e, deep #16a34a
const G_BRIGHT = "#4ade80"
const G_MID   = "#22c55e"
const G_DEEP  = "#16a34a"

// ─── Speedometer Gauge ────────────────────────────────────────────────────────
interface MetricGaugeProps {
  value: number       // 0–100 normalised score
  label: string
  unit?: string
  subtitle?: string
  size?: "sm" | "md" | "lg"
}

export function MetricGauge({ value, label, unit = "", subtitle, size = "md" }: MetricGaugeProps) {
  const v = Math.max(0, Math.min(100, value))
  // Needle rotates from -90° (left end) to +90° (right end)
  const needleDeg = (v / 100) * 180 - 90

  // Arc progress: circumference of the semi-circle path ≈ 125.6
  const ARC_LEN = 125.6
  const filled = (v / 100) * ARC_LEN

  // Pick stroke colour by thirds
  const stroke = v >= 67 ? G_BRIGHT : v >= 34 ? G_MID : G_DEEP

  const sizes = {
    sm: { w: 88,  valSize: "text-sm",  labelSize: "text-[10px]" },
    md: { w: 112, valSize: "text-base", labelSize: "text-xs"    },
    lg: { w: 140, valSize: "text-xl",  labelSize: "text-sm"     },
  }
  const s = sizes[size]

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: s.w }}>
      {/* SVG gauge — viewBox 100×60 so the semi-circle sits in the top half */}
      <svg viewBox="0 0 100 60" width={s.w} height={s.w * 0.6} aria-label={`${label}: ${Math.round(v)}${unit}`}>
        {/* Background arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none" stroke="#1e293b" strokeWidth="8" strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${filled} ${ARC_LEN}`}
          className="transition-all duration-700"
        />
        {/* Needle — translated so its base is at the arc centre (50,50) */}
        <g
          transform={`rotate(${needleDeg}, 50, 50)`}
          className="transition-transform duration-700"
        >
          {/* needle tip stops at 50,14 — well inside the arc, clear of the value text */}
          <line x1="50" y1="50" x2="50" y2="16"
            stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* Centre pivot */}
        <circle cx="50" cy="50" r="3" fill={stroke} />
        {/* Value — placed in the lower half so the needle never covers it */}
        <text x="50" y="56" textAnchor="middle" fontSize="11" fontWeight="700" fill={stroke}>
          {Math.round(v)}{unit}
        </text>
      </svg>
      {subtitle && <p className="text-[10px] text-muted-foreground font-mono">{subtitle}</p>}
      <p className={`${s.labelSize} text-muted-foreground text-center font-medium leading-tight`}>{label}</p>
    </div>
  )
}

// ─── Segmented bar ("signal bars") level indicator ───────────────────────────
interface LevelIndicatorProps {
  level: "excellent" | "strong" | "good" | "moderate" | "acceptable" | "weak" | "low" | "high" | "medium" | "none"
  label: string
  size?: "sm" | "md"
}

export function LevelIndicator({ level, label, size = "md" }: LevelIndicatorProps) {
  const levelMap: Record<string, { bars: number; color: string }> = {
    excellent: { bars: 5, color: G_BRIGHT },
    strong:    { bars: 5, color: G_BRIGHT },
    high:      { bars: 5, color: G_BRIGHT },
    good:      { bars: 4, color: G_MID   },
    moderate:  { bars: 3, color: G_MID   },
    medium:    { bars: 3, color: G_MID   },
    acceptable:{ bars: 3, color: G_MID   },
    weak:      { bars: 2, color: G_DEEP  },
    low:       { bars: 2, color: G_DEEP  },
    none:      { bars: 0, color: "#4b5563"},
  }
  const cfg = levelMap[level] ?? { bars: 0, color: "#4b5563" }
  const containerH = size === "sm" ? 24 : 32
  const barW       = size === "sm" ? 8  : 12

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${5 * barW + 4 * 3} ${containerH}`}
        width={5 * barW + 4 * 3}
        height={containerH}
        aria-label={`${label}: ${level}`}
      >
        {[1, 2, 3, 4, 5].map((bar, i) => {
          const barH = (bar / 5) * containerH
          const active = bar <= cfg.bars
          return (
            <rect
              key={bar}
              x={i * (barW + 3)}
              y={containerH - barH}
              width={barW}
              height={barH}
              rx="2"
              fill={active ? cfg.color : "#1e293b"}
            />
          )
        })}
      </svg>
      <p className={`${size === "sm" ? "text-[10px]" : "text-xs"} text-muted-foreground text-center font-medium capitalize`}>
        {label}
      </p>
    </div>
  )
}

// ─── Circular progress ring ───────────────────────────────────────────────────
interface CircularProgressProps {
  value: number         // raw value to display
  max: number
  label: string
  displayValue?: string // override displayed text (defaults to value)
  maxLabel?: string     // e.g. "/ 30"
  size?: "sm" | "md" | "lg"
}

export function CircularProgress({ value, max, label, displayValue, maxLabel, size = "md" }: CircularProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const R = 36
  const C = 2 * Math.PI * R
  const offset = C - (pct / 100) * C

  const stroke = pct >= 67 ? G_BRIGHT : pct >= 34 ? G_MID : G_DEEP

  const sizes = {
    sm: { w: 72,  valSize: "text-xs",  subSize: "text-[9px]",  labelSize: "text-[10px]" },
    md: { w: 96,  valSize: "text-base",subSize: "text-[10px]", labelSize: "text-xs"     },
    lg: { w: 120, valSize: "text-lg",  subSize: "text-xs",     labelSize: "text-sm"     },
  }
  const s = sizes[size]

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: s.w }}>
      <div className="relative" style={{ width: s.w, height: s.w }}>
        <svg viewBox="0 0 100 100" width={s.w} height={s.w}>
          <circle cx="50" cy="50" r={R} fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={R} fill="none"
            stroke={stroke} strokeWidth="8"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`${s.valSize} font-bold`} style={{ color: stroke }}>
            {displayValue ?? Math.round(value)}
          </span>
          {maxLabel && <span className={`${s.subSize} text-muted-foreground`}>{maxLabel}</span>}
        </div>
      </div>
      <p className={`${s.labelSize} text-muted-foreground text-center font-medium`}>{label}</p>
    </div>
  )
}

// ─── Linear bar metric ────────────────────────────────────────────────────────
interface LinearMetricProps {
  value: number         // 0–100
  label: string
  displayValue: string  // text shown next to label (e.g. "medium")
  levels?: string[]     // optional tick labels
  size?: "sm" | "md"
}

export function LinearMetric({ value, label, displayValue, levels, size = "md" }: LinearMetricProps) {
  const v = Math.max(0, Math.min(100, value))
  const fill = v >= 67 ? G_BRIGHT : v >= 34 ? G_MID : G_DEEP
  const h = size === "sm" ? "h-1.5" : "h-2"
  const txt = size === "sm" ? "text-[10px]" : "text-xs"

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <p className={`${txt} text-muted-foreground font-medium`}>{label}</p>
        <p className={`${txt} font-bold capitalize`} style={{ color: fill }}>{displayValue}</p>
      </div>
      <div className={`w-full ${h} bg-secondary rounded-full overflow-hidden`}>
        <div
          className={`${h} rounded-full transition-all duration-700`}
          style={{ width: `${v}%`, backgroundColor: fill }}
        />
      </div>
      {levels && (
        <div className="flex justify-between">
          {levels.map((l) => (
            <span key={l} className="text-[9px] text-muted-foreground">{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
