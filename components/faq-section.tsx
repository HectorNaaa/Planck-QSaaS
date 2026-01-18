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
    question: "What are Quantum Digital Twins?",
    answer:
      "Digital Twins are virtual copies of real systems that help you predict and optimize how they work. Quantum Digital Twins do this using quantum computing, which can explore many possibilities at once—like having thousands of simulators running simultaneously. This makes them perfect for drug discovery, supply chain planning, and financial optimization.",
  },
  {
    question: "Do I need to be a quantum expert to use Planck?",
    answer:
      "No! Planck is designed for everyone. We provide ready-to-use templates, simple visual tools to build circuits, and AI assistance to guide you. Whether you're new to quantum or experienced, our platform adapts to your level.",
  },
  {
    question: "What real-world problems can I solve?",
    answer:
      "Quantum Digital Twins help with complex challenges: discovering new medicines, optimizing logistics routes, analyzing financial risks, predicting equipment failures, and modeling climate systems. Essentially, any problem where you need to explore countless possibilities quickly.",
  },
  {
    question: "How is quantum different from regular computing?",
    answer:
      "Regular computers process information as 0s and 1s. Quantum computers use qubits that can be both 0 and 1 at the same time, checking many solutions in parallel. This gives quantum computers massive advantages for specific complex problems.",
  },
  {
    question: "How do I keep my Digital Twin accurate?",
    answer:
      "Planck automatically compares your Twin's predictions with real data and updates it when needed. Our system learns from every user's results, continuously improving accuracy across the platform. You can also monitor performance scores and recalibrate when necessary.",
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
