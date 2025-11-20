"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from 'lucide-react'

const faqs = [
  {
    question: "What type of quantum processors (QPUs) does Planck use?",
    answer:
      "Planck leverages gate-based quantum processors with maximum fidelity optimization. Our infrastructure is built on universal quantum computing architectures that utilize logical quantum gates to perform computations. We prioritize high-fidelity operations, meaning we minimize error rates and maximize the accuracy of quantum operations. This approach ensures reliable execution of complex quantum circuits, making our platform suitable for both research and production-level quantum applications. Our systems support various quantum gate operations including single-qubit gates (Hadamard, Pauli, Phase) and multi-qubit gates (CNOT, Toffoli), all calibrated for optimal performance.",
  },
  {
    question: "How does quantum computing differ from classical computing?",
    answer:
      "Quantum computing operates on fundamentally different principles than classical computing. While classical computers use bits (0s and 1s), quantum computers use qubits that can exist in superposition—being both 0 and 1 simultaneously. This allows quantum computers to explore multiple solutions in parallel. Additionally, quantum entanglement enables qubits to be correlated in ways impossible for classical bits, providing exponential computational advantages for specific problem types like optimization, cryptography, molecular simulation, and machine learning.",
  },
  {
    question: "Do I need quantum physics expertise to use Planck?",
    answer:
      "No, you don't need to be a quantum physicist to start using Planck. Our platform is designed with accessibility in mind. We provide pre-built quantum circuit templates, an intuitive drag-and-drop circuit builder, and AI-powered assistance to help you construct and optimize quantum algorithms. Whether you're a researcher exploring quantum applications, a developer integrating quantum computing into your workflow, or a business looking to leverage quantum advantages, Planck's user-friendly interface and comprehensive documentation make quantum computing approachable for users at all experience levels.",
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
        <p className="text-xl text-muted-foreground">Everything you need to know about quantum computing and our software</p>
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
