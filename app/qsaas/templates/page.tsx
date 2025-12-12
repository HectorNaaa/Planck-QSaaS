"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Info } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { useState } from "react"
import Image from "next/image"
import { QUANTUM_TEMPLATES } from "@/lib/constants"

export default function TemplatesPage() {
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({})

  const toggleFlip = (id: string) => {
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleMouseEnter = (id: string) => {
    const timer = setTimeout(() => {
      setFlippedCards((prev) => ({ ...prev, [id]: true }))
    }, 300)
    return () => clearTimeout(timer)
  }

  const handleMouseLeave = (id: string) => {
    setFlippedCards((prev) => ({ ...prev, [id]: false }))
  }

  return (
    <div className="p-8 space-y-8 px-0">
      <PageHeader title="Quantum Templates" description="Explore pre-built quantum algorithms and circuits." />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center">
        {QUANTUM_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="relative w-full max-w-xs min-h-[320px] max-h-[400px] h-[35vh]"
            style={{ perspective: "1000px" }}
            onMouseEnter={() => handleMouseEnter(template.id)}
            onMouseLeave={() => handleMouseLeave(template.id)}
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 ${
                flippedCards[template.id] ? "[transform:rotateY(180deg)]" : ""
              }`}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Front of card */}
              <Card
                className="absolute w-full h-full shadow-lg overflow-hidden"
                style={{ backfaceVisibility: "hidden" }}
              >
                {/* Header with title and info button - top aligned */}
                <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-4">
                  <h3 className="text-xl font-bold text-foreground">{template.name}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFlip(template.id)
                    }}
                    className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                    aria-label="Show details"
                  >
                    <Info className="text-primary" size={20} />
                  </button>
                </div>

                {/* Icon area - centered vertically and horizontally, no gaps */}
                <div className="absolute inset-x-0 top-[60px] bottom-[60px] flex items-center justify-center">
                  <Image
                    src={template.icon || "/placeholder.svg"}
                    alt={template.name}
                    width={160}
                    height={160}
                    className="object-contain max-h-full"
                  />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFlip(template.id)
                    }}
                    className="bg-primary hover:bg-primary/90 w-full text-sm py-2.5"
                  >
                    Learn More
                  </Button>
                </div>
              </Card>

              {/* Back of card */}
              <Card
                className="absolute w-full h-full p-4 flex flex-col shadow-lg overflow-hidden"
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                {/* Info button - top right, aligned with front */}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFlip(template.id)
                    }}
                    className="p-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                    aria-label="Hide details"
                  >
                    <Info className="text-primary" size={20} />
                  </button>
                </div>

                {/* Content - centered vertically */}
                <div className="flex-1 flex flex-col justify-center space-y-3 pr-10">
                  {/* Info section - more compact */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Level:</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                        {template.difficulty}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Minimum qubits:</span>
                      <span className="text-sm font-bold text-foreground">{template.minQubits}</span>
                    </div>
                  </div>

                  {/* Description - compact */}
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground leading-tight line-clamp-5">{template.description}</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
