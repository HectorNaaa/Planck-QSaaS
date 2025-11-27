"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

const quantumFacts = [
  "In 1900 the notion that energy comes in discrete packets reshaped blackbody radiation theory and set the stage for a century of quantum surprises...",
  "In 1925 and 1926 two mathematically different but equivalent formulations of quantum mechanics appeared, giving physicists two languages to describe the same oddities...",
  "In 1935 a thought experiment exposed tensions between locality and completeness in quantum descriptions, sowing seeds for decades of experimental tests...",
  "In 1964 an inequality turned philosophical debate into experiment by predicting measurable limits that separate classical correlations from truly quantum ones...",
  "In the 1980s lab tests confirmed those quantum correlations and the same physics later enabled practical tools where quantum tunneling lets electrons sneak through barriers like impatient commuters, powering tiny electronics and microscopes...",
  "In 1994 a quantum algorithm showed certain classical problems could be solved far faster, forcing cryptography to rethink long term security and giving mathematicians extra material for conference gossip.",
]

export function QuantumLoadingScreen() {
  const [randomFact, setRandomFact] = useState("")

  useEffect(() => {
    // Select random fact on mount
    const randomIndex = Math.floor(Math.random() * quantumFacts.length)
    setRandomFact(quantumFacts[randomIndex])
  }, [])

  return (
    <div className="fixed inset-0 bg-[#fffaec] flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-8 max-w-2xl px-6 text-center">
        {/* Logo */}
        <div className="relative w-24 h-24 animate-pulse">
          <Image src="/images/isotipo-20planck-20png.png" alt="Planck Logo" fill className="object-contain" />
        </div>

        {/* Tagline */}
        <h2 className="text-2xl font-serif text-[#3d3d3d]">Effortless Quantum Computing</h2>

        {/* Loading Spinner */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-[#f5ecd5]"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#578e7e] animate-spin"></div>
        </div>

        {/* Device Recommendation */}
        <div className="bg-[#f5ecd5] border border-[#578e7e]/20 rounded-lg p-4 max-w-md">
          <p className="text-sm text-[#3d3d3d] leading-relaxed">
            <strong>Recommendation:</strong> For the best experience, access this platform from a laptop or desktop
            computer.
          </p>
        </div>

        {/* Random Quantum Fact */}
        <div className="mt-4">
          <p className="text-xs text-[#3d3d3d]/70 leading-relaxed italic">{randomFact}</p>
        </div>
      </div>
    </div>
  )
}
