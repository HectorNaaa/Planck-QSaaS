import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Copy } from "lucide-react"

const templates = [
  {
    id: 1,
    name: "Bell State",
    description: "Create an entangled quantum state",
    minQubits: 2,
    difficulty: "Beginner",
  },
  {
    id: 2,
    name: "Grover's Algorithm",
    description: "Search an unsorted database",
    minQubits: 8,
    difficulty: "Intermediate",
  },
  {
    id: 3,
    name: "Shor's Algorithm",
    description: "Factor large numbers",
    minQubits: 16,
    difficulty: "Advanced",
  },
  {
    id: 4,
    name: "VQE Optimizer",
    description: "Variational Quantum Eigensolver",
    minQubits: 12,
    difficulty: "Advanced",
  },
  {
    id: 5,
    name: "QAOA Circuit",
    description: "Quantum Approximate Optimization Algorithm",
    minQubits: 10,
    difficulty: "Intermediate",
  },
]

export default function TemplatesPage() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Quantum Templates</h1>
        <p className="text-muted-foreground">Explore pre-built quantum algorithms and circuits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <Card key={template.id} className="p-6 flex flex-col shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <BookOpen className="text-primary flex-shrink-0" size={24} />
              <h3 className="text-lg font-bold text-foreground">{template.name}</h3>
            </div>
            <p className="text-muted-foreground text-sm mb-4 flex-grow">{template.description}</p>
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="text-muted-foreground">{template.minQubits} qubits</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  template.difficulty === "Beginner"
                    ? "bg-primary/20 text-primary"
                    : template.difficulty === "Intermediate"
                      ? "bg-accent/20 text-accent"
                      : "bg-secondary/20 text-secondary-foreground"
                }`}
              >
                {template.difficulty}
              </span>
            </div>
            <Button className="bg-primary hover:bg-primary/90 w-full flex items-center justify-center gap-2">
              <Copy size={18} />
              Use Template
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
