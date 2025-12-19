"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const faqs = [
  {
    question: "What type of quantum processors (QPUs) does Planck use?",
    answer:
      "Planck leverages gate-based quantum processors with maximum fidelity optimization. Our infrastructure is built on universal quantum computing architectures that utilize logical quantum gates to perform computations, prioritazing high-fidelity operations (i.e. >99.5% fidelity on 1-qubit gate) among other benchmarks. Meaning we minimize error rates and maximize the accuracy of quantum operations at the lowest price, ensuring the optimal tradeoff options based on user needs. This approach makes our platform suitable for both research and enterprise-level quantum applications.",
  },
  {
    question: "How does quantum computing differ from classical computing?",
    answer:
      "Quantum computing operates on fundamentally different principles than classical computing. While classical computers use bits (0s and 1s), quantum computers use qubits that can exist in superposition—being both 0 and 1 simultaneously. This allows quantum computers to explore multiple solutions in parallel. Additionally, quantum entanglement enables qubits to be correlated in ways impossible for classical bits, providing exponential computational advantages for specific problem types like financial optimization, molecular simulation, machine learning for AI systems....",
  },
  {
    question: "Do I need quantum expertise to start?",
    answer:
      "No, you don't need to be a quantum physicist to start using Planck. Our platform is designed with accessibility in mind. We provide pre-built quantum circuit templates, an intuitive drag-and-drop circuit builder, and AI-powered assistance to help you construct and optimize quantum cases. Whether you're a researcher exploring quantum applications, a developer integrating quantum computing into your workflow, or a business looking to leverage quantum advantages, Planck's user-friendly interface despite having high performance modules to avoid bottlenecks make quantum computing approachable for users at all experience levels.",
  },
  {
    question: "How would quantum computing benefit my data models and simulations?",
    answer:
      "Quantum computing provides transformative advantages for understanding and optimizing complex data models. By leveraging quantum superposition and entanglement, you can explore exponentially larger solution spaces simultaneously, revealing hidden patterns and correlations in your data that classical methods might miss. For simulations, quantum systems naturally model quantum phenomena like molecular interactions and material properties with unprecedented accuracy. The optimization capabilities allow you to fine-tune model parameters across vast dimensional spaces efficiently, leading to better predictions, more robust models, and deeper insights into your data's underlying structure—all while reducing computational time for certain problem classes from years to minutes.",
  },
  {
    question: "Why use quantum-inspired methods instead of classical solvers?",
    answer:
      "They offer a low-risk path to practical gains—better problem representations, new exploration heuristics and reduced sampling variance on classical hardware among other less relevant benefits. All that for free and ensuring minimum latency.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div className="text-center mb-20 mt-16">
        <h2 className="text-4xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
        <p className="text-xl text-muted-foreground">
          Everything you need to know about quantum computing and our software
        </p>
      </div>

      <div className="space-y-4">
        {faqs.map((faq, index) => (
          <div
            key={index}
            className="border border-border rounded-lg shadow-md hover:shadow-lg transition-all duration-300 bg-card"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-secondary/50 transition-colors rounded-lg bg-secondary shadow-lg"
            >
              <h3 className="text-lg font-semibold text-foreground pr-8">{faq.question}</h3>
              {openIndex === index ? (
                <ChevronUp className="text-primary flex-shrink-0" size={24} />
              ) : (
                <ChevronDown className="text-muted-foreground flex-shrink-0" size={24} />
              )}
            </button>
            {openIndex === index && (
              <div className="px-6 pb-4 pt-2">
                <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
