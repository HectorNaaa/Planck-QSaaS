"use client"

// Simple translation dictionary for ES only
// All source content is in English
const esTranslations: Record<string, string> = {
  // Landing - Hero
  Effortless: "Sin Esfuerzo",
  "Quantum Solutions": "Soluciones Cuánticas",
  "Welcome to the new computing era, simulate and optimize your data models with quantum computing, AI-enhanced.":
    "Bienvenido a la nueva era de la computación, simula y optimiza tus modelos de datos con computacion cuántica. Mejorado con IA.",
  Access: "Acceder",
  "Watch Video": "Ver Vídeo",

  // Navigation
  Features: "Características",
  Pricing: "Precios",
  Docs: "Documentación",

  // Features section
  "Lightning Fast": "Ultrarrápido",
  "53x faster computing executions than market standards": "53x más rápido computacionalemnte que los estándares del mercado",
  "Powerful Analytics": "Análisis Potentes",
  "Monitor, analyze and understand your model": "Monitorea, consulta y entiende tu modelo",
  "Hybrid Approach": "Enfoque Híbrido",
  "Toggle auto/manual configurations. Customize your workflow":
    "Alterna configuración auto/manual.Personaliza tu flujo de trabajo",

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

  // Sign up page
  "Create Account": "Crear Cuenta",
  "Join Planck and start quantum computing": "Únete a Planck y comienza con computación cuántica",
  "First Name": "Nombre",
  "Last Name": "Apellido",
  Email: "Correo Electrónico",
  Password: "Contraseña",
  "Confirm Password": "Confirmar Contraseña",
  "Country of Residence": "País de Residencia",
  "Phone Number": "Número de Teléfono",
  "What's your role?": "¿Cuál es tu rol?",
  "Select country": "Selecciona país",
  "Select your role": "Selecciona tu rol",
  "Terms and Conditions": "Términos y Condiciones",
  "I have read and accept the terms and conditions": "He leído y acepto los términos y condiciones",
  "(Scroll to the bottom to enable)": "(Desplázate hasta el final para habilitar)",
  "Creating account...": "Creando cuenta...",
  "Already have an account?": "¿Ya tienes una cuenta?",
  "Sign in": "Inicia sesión",

  // Errors
  "You must accept the terms and conditions": "Debes aceptar los términos y condiciones",
  "Passwords do not match": "Las contraseñas no coinciden",
  "Please select country and occupation": "Por favor selecciona país y ocupación",
  "Phone number is required": "El número de teléfono es obligatorio",
  "First name and last name are required": "Nombre y apellido son obligatorios",
  "An error occurred": "Ocurrió un error",

  // Delete Account feature
  "Delete Account": "Eliminar Cuenta",
  "Are you sure you want to delete your account? This action cannot be undone and will permanently delete all your data, including execution logs and circuit history.":
    "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer y eliminará permanentemente todos tus datos, incluyendo registros de ejecución e historial de circuitos.",
  Cancel: "Cancelar",
  "Deleting...": "Eliminando...",
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
