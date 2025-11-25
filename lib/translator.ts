"use client"

// Simple translation dictionary for ES only
// All source content is in English
const esTranslations: Record<string, string> = {
  // Landing - Hero
  Effortless: "Sin Esfuerzo",
  "Quantum Solutions": "Soluciones Cuánticas",
  "Welcome to the new computing era, connect your data and start using quantum computing. AI-Enhanced.":
    "Bienvenido a la nueva era de la computación, conecta tus datos y comienza a usar computación cuántica. Mejorado con IA.",
  Access: "Acceder",
  "Watch Demo": "Ver Demo",

  // Navigation
  Features: "Características",
  Pricing: "Precios",
  Docs: "Documentación",

  // Features section
  "Lightning Fast": "Ultrarrápido",
  "53x faster executions than quantum market standards": "53x más rápido que los estándares del mercado cuántico",
  "Powerful Analytics": "Análisis Potentes",
  "Monitor, ask and analyze quantum data": "Monitorea, consulta y analiza datos cuánticos",
  "Hybrid Approach": "Enfoque Híbrido",
  "Toggle auto/manual settings. Change between classic/quantum instances":
    "Alterna configuración auto/manual. Cambia entre instancias clásicas/cuánticas",

  // CTA
  "Ready to build quantum?": "¿Listo para construir con cuántica?",
  "Lets build the computing future": "Construyamos el futuro de la computación",

  // Footer
  "Next-generation quantum computing platform for researchers and enterprises.":
    "Plataforma de computación cuántica de próxima generación para investigadores y empresas.",
  Links: "Enlaces",
  Legal: "Legal",
  "Privacy Policy": "Política de Privacidad",
  "Legal Notice": "Aviso Legal",
  "© 2025 Planck. All rights reserved.": "© 2025 Planck. Todos los derechos reservados.",
  Sections: "Secciones",
  Privacy: "Privacidad",
  Terms: "Términos",
  "© 2025 Planck Technologies": "© 2025 Planck Technologies",

  "Improve Models": "Mejorar Modelos",
  "Help us improve algorithms by sharing your benchmarks and usage data":
    "Ayúdanos a mejorar los algoritmos compartiendo tus benchmarks y datos de uso",

  // QSaaS Navigation
  Dashboard: "Panel",
  Runner: "Ejecutor",
  Templates: "Plantillas",
  Settings: "Configuración",
  "Sign Out": "Cerrar Sesión",

  // Common
  Language: "Idioma",
  "Dark Mode": "Modo Oscuro",
  "Light Mode": "Modo Claro",
}

export function translate(text: string, targetLang: "en" | "es"): string {
  if (targetLang === "en") {
    return text
  }

  // For Spanish, check if translation exists
  return esTranslations[text] || text
}

export function useTranslate() {
  return { translate }
}
