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
    question: "What are Quantum Digital Twins and how do they work?",
    answer:
      "Quantum Digital Twins are virtual replicas of physical systems or data models that leverage quantum computing to provide unprecedented simulation accuracy and optimization capabilities. Unlike classical digital twins, they use quantum superposition and entanglement to model complex interdependencies and explore exponentially larger solution spaces simultaneously. This enables you to simulate molecular behaviors, optimize supply chains, predict system failures, and test scenarios that would be computationally infeasible with classical methods—all while capturing quantum effects that classical twins miss.",
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
    question: "What real-world problems can Quantum Digital Twins solve?",
    answer:
      "Quantum Digital Twins excel at solving complex optimization and simulation challenges across industries. In pharmaceuticals, they can simulate molecular interactions for drug discovery with atomic precision. For supply chain management, they optimize routing and inventory across thousands of variables simultaneously. In finance, they model portfolio risks and market dynamics that classical methods struggle with. Manufacturing benefits from predictive maintenance by simulating equipment degradation at the quantum level. Climate scientists use them to model atmospheric systems with unprecedented detail. The key advantage is handling problems where classical digital twins hit computational limits due to exponential complexity or quantum mechanical effects.",
  },
  {
    question: "How do I ensure my Quantum Digital Twin stays accurate over time?",
    answer:
      "Maintaining accuracy requires continuous calibration with real-world data and leveraging Planck's built-in error mitigation. Our platform automatically tracks model drift by comparing twin predictions with actual system measurements, triggering recalibration when deviations exceed thresholds. The reinforcement learning module learns from every execution across all users (network effect), continuously improving recommendations for shots, backend selection, and error correction strategies specific to your use case. You can also version your twins, run A/B tests between quantum and classical approaches, and monitor fidelity scores to ensure your simulations remain reliable as your physical system evolves.",
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
