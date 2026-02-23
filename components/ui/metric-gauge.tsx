"use client"

interface MetricGaugeProps {
  value: number // 0-100
  label: string
  size?: "sm" | "md" | "lg"
  color?: "green" | "yellow" | "red" | "blue" | "purple"
  showValue?: boolean
}

export function MetricGauge({ 
  value, 
  label, 
  size = "md", 
  color = "blue",
  showValue = true 
}: MetricGaugeProps) {
  const normalizedValue = Math.max(0, Math.min(100, value))
  const rotation = (normalizedValue / 100) * 180 - 90

  const sizeClasses = {
    sm: { container: "w-20 h-20", text: "text-xs", label: "text-[10px]", value: "text-sm" },
    md: { container: "w-28 h-28", text: "text-sm", label: "text-xs", value: "text-lg" },
    lg: { container: "w-36 h-36", text: "text-base", label: "text-sm", value: "text-2xl" },
  }

  const colorClasses = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
  }

  const colorStrokes = {
    green: "#4ade80",
    yellow: "#facc15",
    red: "#f87171",
    blue: "#60a5fa",
    purple: "#c084fc",
  }

  const sz = sizeClasses[size]

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`${sz.container} relative`}>
        <svg viewBox="0 0 100 100" className="transform -rotate-90">
          {/* Background arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-secondary"
          />
          {/* Value arc */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={colorStrokes[color]}
            strokeWidth="8"
            strokeDasharray={`${(normalizedValue / 100) * 126} 126`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
          {/* Needle */}
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="15"
            stroke={colorStrokes[color]}
            strokeWidth="2"
            strokeLinecap="round"
            style={{ transformOrigin: "50% 50%", transform: `rotate(${rotation}deg)` }}
            className="transition-transform duration-700"
          />
          {/* Center dot */}
          <circle cx="50" cy="50" r="3" fill={colorStrokes[color]} />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center pt-4">
            <span className={`${sz.value} font-bold ${colorClasses[color]}`}>
              {normalizedValue.toFixed(0)}
            </span>
          </div>
        )}
      </div>
      <p className={`${sz.label} text-muted-foreground text-center font-medium`}>{label}</p>
    </div>
  )
}

interface LevelIndicatorProps {
  level: "excellent" | "strong" | "good" | "moderate" | "acceptable" | "weak" | "low" | "high" | "medium" | "none"
  label: string
  size?: "sm" | "md"
}

export function LevelIndicator({ level, label, size = "md" }: LevelIndicatorProps) {
  const levelMap = {
    excellent: { bars: 5, color: "bg-green-400" },
    strong: { bars: 5, color: "bg-green-400" },
    high: { bars: 5, color: "bg-green-400" },
    good: { bars: 4, color: "bg-blue-400" },
    moderate: { bars: 3, color: "bg-yellow-400" },
    medium: { bars: 3, color: "bg-yellow-400" },
    acceptable: { bars: 3, color: "bg-yellow-400" },
    weak: { bars: 2, color: "bg-orange-400" },
    low: { bars: 2, color: "bg-orange-400" },
    none: { bars: 0, color: "bg-gray-400" },
  }

  const config = levelMap[level] || { bars: 0, color: "bg-gray-400" }
  const barHeight = size === "sm" ? "h-6" : "h-8"
  const barWidth = size === "sm" ? "w-2" : "w-3"

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex items-end gap-1 ${size === "sm" ? "h-6" : "h-8"}`}>
        {[1, 2, 3, 4, 5].map((bar) => (
          <div
            key={bar}
            className={`${barWidth} ${barHeight} rounded-t transition-all duration-500`}
            style={{
              height: `${(bar / 5) * 100}%`,
              backgroundColor: bar <= config.bars ? config.color.replace("bg-", "") : undefined,
            }}
          >
            <div
              className={`w-full h-full rounded-t ${bar <= config.bars ? config.color : "bg-secondary/50"}`}
            />
          </div>
        ))}
      </div>
      <p className={`${size === "sm" ? "text-[10px]" : "text-xs"} text-muted-foreground text-center font-medium capitalize`}>
        {label}
      </p>
    </div>
  )
}
