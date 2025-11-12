"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"

export function InteractiveQubit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [qubits, setQubits] = useState<Array<{ id: number; x: number; y: number; active: boolean }>>([])

  useEffect(() => {
    // Generate grid of qubits
    const generatedQubits = []
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        generatedQubits.push({
          id: i * 6 + j,
          x: 60 + i * 80,
          y: 60 + j * 80,
          active: false,
        })
      }
    }
    setQubits(generatedQubits)
  }, [])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePosition({ x, y })

    // Update qubit active state based on proximity
    setQubits((prevQubits) =>
      prevQubits.map((qubit) => {
        const distance = Math.sqrt((qubit.x - x) ** 2 + (qubit.y - y) ** 2)
        return {
          ...qubit,
          active: distance < 50,
        }
      }),
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full h-96 bg-gradient-to-br from-secondary/30 to-transparent rounded-2xl border border-primary/20 overflow-hidden"
    >
      {/* SVG Grid Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
        <defs>
          <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" className="text-primary" />
      </svg>

      {/* Qubits */}
      {qubits.map((qubit) => (
        <div
          key={qubit.id}
          className={`absolute w-8 h-8 rounded-full transition-all duration-200 transform ${
            qubit.active ? "bg-primary shadow-lg shadow-primary/50 scale-125" : "bg-primary/30 scale-100"
          }`}
          style={{
            left: `${qubit.x}px`,
            top: `${qubit.y}px`,
            transform: `translate(-50%, -50%) ${qubit.active ? "scale(1.25)" : "scale(1)"}`,
          }}
        />
      ))}

      {/* Center Text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-muted-foreground text-sm">Drag your cursor over the qubits</p>
        </div>
      </div>
    </div>
  )
}
