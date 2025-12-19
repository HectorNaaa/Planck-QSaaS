"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { Line, Scatter } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"
import { useRef } from "react"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface ExecutionLog {
  id: string
  circuit_name: string
  algorithm: string
  backend: string
  runtime_ms: number
  shots: number
  success_rate: number
  created_at: string
  qubits_used: number // Added qubits_used field
}

interface ExecutionChartsProps {
  logs: ExecutionLog[]
  timeRange: string
}

export function ExecutionCharts({ logs, timeRange }: ExecutionChartsProps) {
  const latencyChartRef = useRef<any>(null)
  const backendChartRef = useRef<any>(null)
  const fidelityChartRef = useRef<any>(null)

  const brandGreen = "rgb(87, 142, 126)"
  const brandGreenLight = "rgba(87, 142, 126, 0.1)"
  const darkGray = "rgb(64, 64, 64)" // Added dark gray color for qubit line

  const latencyData = {
    labels: logs.map((_, idx) => `#${idx + 1}`),
    datasets: [
      {
        label: "Runtime (ms)",
        data: logs.map((log) => log.runtime_ms || 0),
        borderColor: brandGreen,
        backgroundColor: brandGreenLight,
        tension: 0.4,
        fill: true,
        yAxisID: "y",
      },
      {
        label: "Qubits",
        data: logs.map((log) => log.qubits_used || 2),
        borderColor: darkGray,
        backgroundColor: "transparent",
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        yAxisID: "y1",
      },
    ],
  }

  const backendMap: { [key: string]: number } = {
    classical: 1,
    Classical: 1,
    hpc: 2,
    HPC: 2,
    quantum_qpu: 3,
    "Quantum QPU": 3,
  }

  const backendData = {
    labels: logs.map((_, idx) => `#${idx + 1}`),
    datasets: [
      {
        label: "Backend Type",
        data: logs.map((log, idx) => ({
          x: idx + 1,
          y: backendMap[log.backend] || backendMap[log.backend.toLowerCase()] || 1,
        })),
        backgroundColor: brandGreen,
        pointRadius: 6,
        pointHoverRadius: 8,
        yAxisID: "y",
      },
      {
        label: "Qubits",
        data: logs.map((log, idx) => ({
          x: idx + 1,
          y: log.qubits_used || 2,
        })),
        backgroundColor: darkGray,
        pointRadius: 4,
        pointHoverRadius: 6,
        showLine: true,
        borderColor: darkGray,
        yAxisID: "y1",
      },
    ],
  }

  const fidelityData = {
    labels: logs.map((_, idx) => `#${idx + 1}`),
    datasets: [
      {
        label: "Success Rate (%)",
        data: logs.map((log) => log.success_rate || 0),
        borderColor: brandGreen,
        backgroundColor: brandGreenLight,
        tension: 0.4,
        fill: true,
        yAxisID: "y",
      },
      {
        label: "Qubits",
        data: logs.map((log) => log.qubits_used || 2),
        borderColor: darkGray,
        backgroundColor: "transparent",
        tension: 0.4,
        fill: false,
        pointRadius: 4,
        yAxisID: "y1",
      },
    ],
  }

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        beginAtZero: true,
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        beginAtZero: true,
        title: {
          display: true,
          text: "Qubits",
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  }

  const scatterChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const datasetLabel = context.dataset.label
            if (datasetLabel === "Backend Type") {
              const log = logs[context.parsed.x - 1]
              const backendDisplay =
                log.backend === "quantum_qpu" ? "Quantum QPU" : log.backend === "hpc" ? "HPC" : "Classical"
              return `${log.circuit_name} - ${backendDisplay}`
            } else if (datasetLabel === "Qubits") {
              return `Qubits: ${context.parsed.y}`
            }
            return ""
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Execution Number",
        },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        title: {
          display: true,
          text: "Backend Type",
        },
        ticks: {
          callback: (value: any) => {
            const backends = ["", "Classical", "HPC", "Quantum QPU"]
            return backends[value] || ""
          },
          stepSize: 1,
        },
        min: 0,
        max: 4,
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        beginAtZero: true,
        title: {
          display: true,
          text: "Qubits",
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  }

  const downloadChartAsSVG = (chartRef: any, filename: string) => {
    if (!chartRef.current) return

    const canvas = chartRef.current.canvas
    const ctx = canvas.getContext("2d")

    // Convert canvas to SVG
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            <img src="${canvas.toDataURL()}" width="${canvas.width}" height="${canvas.height}"/>
          </div>
        </foreignObject>
      </svg>
    `

    const blob = new Blob([svgString], { type: "image/svg+xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (logs.length === 0) {
    return (
      <Card className="p-6 shadow-lg bg-secondary">
        <p className="text-muted-foreground text-center py-8">No execution data available for {timeRange}.</p>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="p-6 shadow-lg bg-secondary">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Execution Latencies</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadChartAsSVG(latencyChartRef, "latencies.svg")}
            className="flex items-center gap-1"
          >
            <Download size={16} />
            SVG
          </Button>
        </div>
        <div className="h-64">
          <Line ref={latencyChartRef} data={latencyData} options={lineChartOptions} />
        </div>
      </Card>

      <Card className="p-6 shadow-lg bg-secondary">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Backend Selection</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadChartAsSVG(backendChartRef, "backends.svg")}
            className="flex items-center gap-1"
          >
            <Download size={16} />
            SVG
          </Button>
        </div>
        <div className="h-64">
          <Scatter ref={backendChartRef} data={backendData} options={scatterChartOptions} />
        </div>
      </Card>

      <Card className="p-6 shadow-lg bg-secondary">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Success Rates</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => downloadChartAsSVG(fidelityChartRef, "success_rates.svg")}
            className="flex items-center gap-1"
          >
            <Download size={16} />
            SVG
          </Button>
        </div>
        <div className="h-64">
          <Line ref={fidelityChartRef} data={fidelityData} options={lineChartOptions} />
        </div>
      </Card>
    </div>
  )
}
