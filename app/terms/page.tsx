"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"

export default function TermsPage() {
  const { language } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/">
          <Button variant="outline" className="mb-8 bg-transparent">
            <ArrowLeft className="mr-2" size={16} />
            {language === "es" ? "Volver al inicio" : "Back to home"}
          </Button>
        </Link>

        <h1 className="text-4xl font-bold text-foreground mb-4">
          {language === "es" ? "Aviso Legal" : "Legal Notice"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {language === "es" ? "Última actualización: " : "Last updated: "}
          {new Date().toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
        </p>

        <div className="prose prose-lg max-w-none space-y-6 text-foreground">
          {language === "es" ? (
            <>
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Identificación</h2>
                <p className="text-muted-foreground">
                  Titular: <strong>Planck Computing SaaS</strong>
                  <br />
                  Email: hello@plancktechnologies.xyz
                  <br />
                  Actividad: Plataforma SaaS de computación cuántica
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Condiciones de Uso</h2>
                <p className="text-muted-foreground">
                  El acceso y uso de este sitio web otorga la condición de USUARIO, que acepta las presentes Condiciones
                  Generales de Uso. El USUARIO se compromete a utilizar el sitio conforme a la ley, la moral y el orden
                  público.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. Responsabilidades del Usuario</h2>
                <p className="text-muted-foreground">El USUARIO se compromete a:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>No realizar acciones que dañen, inutilicen o sobrecarguen la plataforma</li>
                  <li>No introducir virus, malware o código malicioso</li>
                  <li>No intentar acceder a áreas restringidas del sistema</li>
                  <li>Usar los recursos de computación cuántica de forma responsable</li>
                  <li>Respetar los límites de uso de su plan de suscripción</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Propiedad Intelectual</h2>
                <p className="text-muted-foreground">
                  Todos los contenidos del sitio web (programación, diseño, logotipos, textos, gráficos) son propiedad
                  de Planck o disponemos de licencia para su uso. Queda prohibida la reproducción, distribución o
                  transformación sin autorización expresa.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Limitación de Responsabilidad</h2>
                <p className="text-muted-foreground">Planck no se hace responsable de:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Interrupciones del servicio por mantenimiento o causas técnicas</li>
                  <li>Resultados de cálculos cuánticos (ofrecidos "tal cual")</li>
                  <li>Pérdida de datos por causas ajenas a nuestro control</li>
                  <li>Errores en circuitos cuánticos creados por el usuario</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Recopilación de Datos para Mejora de Modelos</h2>
                <p className="text-muted-foreground">
                  Por defecto, Planck recopila datos anonimizados de benchmarks, patrones de uso y métricas de ejecución
                  de circuitos para mejorar nuestros algoritmos cuánticos y optimizar la experiencia de usuario. Esto
                  incluye:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Tiempos de ejecución de circuitos y mediciones de fidelidad</li>
                  <li>Benchmarks de rendimiento de backends</li>
                  <li>Patrones de optimización de algoritmos</li>
                  <li>Estadísticas agregadas de uso</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Los usuarios pueden desactivar esta recopilación de datos en cualquier momento a través del
                  interruptor "Improve Models" en Configuración → Preferencias. No se recopila información de
                  identificación personal y todos los datos se tratan de acuerdo con nuestra Política de Privacidad.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Modificaciones</h2>
                <p className="text-muted-foreground">
                  Nos reservamos el derecho de modificar las Condiciones de Uso en cualquier momento. Los cambios se
                  publicarán en esta página y entrarán en vigor inmediatamente.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Legislación Aplicable</h2>
                <p className="text-muted-foreground">
                  Las presentes condiciones se rigen por la legislación española. Para cualquier controversia, las
                  partes se someten a los tribunales de Barcelona.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Contacto</h2>
                <p className="text-muted-foreground">
                  Para consultas sobre este Aviso Legal:
                  <br />
                  Email: hello@plancktechnologies.xyz
                  <br />
                  Asunto: "Consulta Legal"
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Identification</h2>
                <p className="text-muted-foreground">
                  Owner: <strong>Planck Computing SaaS</strong>
                  <br />
                  Email: hello@plancktechnologies.xyz
                  <br />
                  Activity: Quantum computing SaaS platform
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Terms of Use</h2>
                <p className="text-muted-foreground">
                  Access and use of this website grants USER status, which accepts these General Terms of Use. The USER
                  agrees to use the site in accordance with the law, morality, and public order.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. User Responsibilities</h2>
                <p className="text-muted-foreground">The USER agrees to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Not perform actions that damage, disable, or overload the platform</li>
                  <li>Not introduce viruses, malware, or malicious code</li>
                  <li>Not attempt to access restricted system areas</li>
                  <li>Use quantum computing resources responsibly</li>
                  <li>Respect subscription plan usage limits</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Intellectual Property</h2>
                <p className="text-muted-foreground">
                  All website content (programming, design, logos, texts, graphics) is owned by Planck or we have a
                  license for its use. Reproduction, distribution, or transformation is prohibited without express
                  authorization.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Limitation of Liability</h2>
                <p className="text-muted-foreground">Planck is not responsible for:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Service interruptions due to maintenance or technical issues</li>
                  <li>Quantum calculation results (provided "as is")</li>
                  <li>Data loss due to causes beyond our control</li>
                  <li>Errors in user-created quantum circuits</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Data Collection for Model Improvement</h2>
                <p className="text-muted-foreground">
                  By default, Planck collects anonymized benchmark data, usage patterns, and circuit execution metrics
                  to improve our quantum algorithms and enhance user experience. This includes:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Circuit execution times and fidelity measurements</li>
                  <li>Backend performance benchmarks</li>
                  <li>Algorithm optimization patterns</li>
                  <li>Aggregated usage statistics</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Users may opt-out of this data collection at any time through the "Improve Models" toggle in Settings
                  → Preferences. No personally identifiable information is collected, and all data is handled in
                  accordance with our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Modifications</h2>
                <p className="text-muted-foreground">
                  We reserve the right to modify the Terms of Use at any time. Changes will be published on this page
                  and take effect immediately.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Applicable Law</h2>
                <p className="text-muted-foreground">
                  These conditions are governed by Spanish law. For any dispute, the parties submit to the courts of
                  Madrid.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Contact</h2>
                <p className="text-muted-foreground">
                  For inquiries about this Legal Notice:
                  <br />
                  Email: hello@plancktechnologies.xyz
                  <br />
                  Subject: "Legal Inquiry"
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
