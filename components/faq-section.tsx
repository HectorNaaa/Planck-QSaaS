"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const faqs = [
  {
    question: "What kind of problems is this actually useful for?",
    answer:
      "Planck is designed for high-dimensional optimization and simulation problems where classical approaches become too slow, unstable, or expensive to scale. This typically appears in scenarios where many variables interact at once and the number of possible configurations grows very quickly. In practice, this includes things like portfolio optimization with many correlated assets, energy grid balancing under uncertainty, supply chain optimization, or complex risk modeling. If your system requires exploring a large number of possible outcomes under constraints, it is likely a strong candidate.",
  },
  {
    question: "When is quantum actually better than classical?",
    answer:
      "Quantum is not a replacement for classical computing. It becomes useful when classical methods struggle due to the size or complexity of the search space. Planck uses hybrid quantum-classical approaches. Classical systems handle data preparation and structure, while quantum routines are used in the parts of the problem that benefit from exploring many possibilities simultaneously. The goal is not to replace what already works, but to extend what is currently possible.",
  },
  {
    question: "What ROI can I expect?",
    answer:
      "The return on investment depends on the specific use case, but it generally comes from three areas: faster computation, lower infrastructure cost, and better optimization outcomes. In many cases, reducing simulation time means running more iterations in the same time window, which directly improves decision quality. For example, faster portfolio simulations allow better rebalancing timing, and faster system simulations allow more scenarios to be tested before acting. The most reliable way to measure ROI is through a short proof of concept using your own data.",
  },
  {
    question: "Do I need to change my existing infrastructure?",
    answer:
      "No. Planck is designed to integrate with existing systems rather than replace them. It can ingest standard data formats and connect to existing pipelines. The results are returned in formats that can be consumed by your current tools, so your internal workflows remain intact. The platform acts as an additional computational layer rather than a disruptive change.",
  },
  {
    question: "Is this production-ready or experimental?",
    answer:
      "Planck is built to deliver value today using hybrid methods. While quantum hardware is still evolving, the system combines classical computation with available quantum backends and includes fallback mechanisms to ensure reliability. This allows it to be used in real workflows without depending entirely on quantum hardware maturity.",
  },
  {
    question: "How does this compare to classical HPC or GPUs?",
    answer:
      "Classical HPC and GPUs scale by increasing computational resources, which can become expensive and inefficient as problem size grows. Planck focuses on improving how the problem is solved rather than just increasing compute power. By using hybrid algorithms, it reduces the effective complexity of certain tasks and allows exploration of solution spaces that would otherwise be impractical. It should be seen as complementary to HPC, not as a replacement.",
  },
  {
    question: "Do I need to understand quantum computing to use this?",
    answer:
      "No. The platform abstracts all quantum-related complexity. From the user perspective, it behaves as an advanced optimization and simulation engine. You define the problem and provide the data, and the system handles method selection and execution internally.",
  },
  {
    question: "How do I know if my problem is a good fit?",
    answer:
      "A good fit usually involves optimization under constraints, systems with many interacting variables, or situations where classical methods are too slow or expensive. If improving computation speed or exploring more solution scenarios would directly improve your decision-making, then it is worth evaluating. This is typically validated through an initial analysis or a small proof of concept.",
  },
]

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section id="faq" className="relative overflow-hidden py-24">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/60" />
      {/* Subtle teal gradient top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      {/* Subtle teal gradient bottom */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      {/* Decorative blurred teal orb top-right */}
      <div className="absolute -top-24 right-0 w-96 h-96 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      {/* Decorative blurred teal orb bottom-left */}
      <div className="absolute -bottom-24 left-0 w-80 h-80 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      {/* Dot grid pattern */}
      <div className="faq-dot-grid absolute inset-0 opacity-[0.035] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-primary mb-3 border border-primary/25 rounded-full px-4 py-1 bg-primary/8">
            FAQ
          </span>
          <h2 className="text-4xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Practical answers about how Planck works and whether it is the right fit for your use case.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-border/70 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 bg-card/80 backdrop-blur-sm overflow-hidden"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-4 flex justify-between items-center text-left hover:bg-primary/5 transition-colors duration-200"
              >
                <h3 className="text-base font-semibold text-foreground pr-8 leading-snug">{faq.question}</h3>
                {openIndex === index ? (
                  <ChevronUp className="text-primary flex-shrink-0" size={20} />
                ) : (
                  <ChevronDown className="text-muted-foreground flex-shrink-0" size={20} />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5 pt-1 border-t border-border/50">
                  <p className="text-muted-foreground leading-relaxed text-sm">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
