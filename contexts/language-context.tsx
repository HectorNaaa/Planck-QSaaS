"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

type Language = "en" | "es"

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

const translations = {
  en: {
    // Landing
    "hero.title": "Effortless",
    "hero.quantum": "Quantum Solutions",
    "hero.subtitle": "Welcome to the new computing era, connect your data and start using quantum computing. AI-Enhanced.",
    "hero.access": "Access",
    "hero.demo": "Watch Demo",
    "nav.features": "Features",
    "nav.pricing": "Pricing",
    "nav.docs": "Docs",
    "features.title": "Features",
    "features.fast.title": "Lightning Fast",
    "features.fast.desc": "53x faster executions than quantum market standards",
    "features.analytics.title": "Powerful Analytics",
    "features.analytics.desc": "Monitor, ask and analyze quantum data",
    "features.hybrid.title": "Hybrid Approach",
    "features.hybrid.desc": "Toggle auto/manual settings. Change between classic/quantum instances",
    "cta.title": "Ready to build quantum?",
    "cta.subtitle": "Lets build the computing future",
    "footer.copyright": "© 2025 Planck. Effortless Quantum Solutions.",
    // QSaaS
    "sidebar.dashboard": "Dashboard",
    "sidebar.runner": "Quantum Runner",
    "sidebar.templates": "Templates",
    "sidebar.settings": "Settings",
    "sidebar.billing": "Billing",
    "sidebar.signout": "Sign Out",
  },
  es: {
    // Landing
    "hero.title": "Soluciones Cuánticas",
    "hero.quantum": "Sin Esfuerzo",
    "hero.subtitle": "Bienvenido a la nueva era de la computación, conecta tus datos y comienza a usar computación cuántica. Mejorado con IA.",
    "hero.access": "Acceder",
    "hero.demo": "Ver Demo",
    "nav.features": "Características",
    "nav.pricing": "Precios",
    "nav.docs": "Documentación",
    "features.title": "Características",
    "features.fast.title": "Ultrarrápido",
    "features.fast.desc": "53x más rápido que los estándares del mercado cuántico",
    "features.analytics.title": "Análisis Potentes",
    "features.analytics.desc": "Monitorea, consulta y analiza datos cuánticos",
    "features.hybrid.title": "Enfoque Híbrido",
    "features.hybrid.desc": "Alterna configuración auto/manual. Cambia entre instancias clásicas/cuánticas",
    "cta.title": "¿Listo para construir con cuántica?",
    "cta.subtitle": "Construyamos el futuro de la computación",
    "footer.copyright": "© 2025 Planck. Soluciones Cuánticas Sin Esfuerzo.",
    // QSaaS
    "sidebar.dashboard": "Panel",
    "sidebar.runner": "Ejecutor Cuántico",
    "sidebar.templates": "Plantillas",
    "sidebar.settings": "Configuración",
    "sidebar.billing": "Facturación",
    "sidebar.signout": "Cerrar Sesión",
  },
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")

  useEffect(() => {
    const saved = localStorage.getItem("language") as Language
    if (saved && (saved === "en" || saved === "es")) {
      setLanguageState(saved)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  const t = (key: string) => {
    return translations[language][key as keyof typeof translations.en] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider")
  }
  return context
}
