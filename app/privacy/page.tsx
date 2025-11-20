"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/contexts/language-context"

export default function PrivacyPage() {
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
          {language === "es" ? "Política de Privacidad" : "Privacy Policy"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {language === "es" ? "Última actualización: " : "Last updated: "}
          {new Date().toLocaleDateString(language === "es" ? "es-ES" : "en-US")}
        </p>

        <div className="prose prose-lg max-w-none space-y-6 text-foreground">
          {language === "es" ? (
            <>
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Responsable del Tratamiento</h2>
                <p className="text-muted-foreground">
                  El responsable del tratamiento de los datos personales recogidos en este sitio web es:
                  <br />
                  <strong>Planck Computing SaaS</strong>
                  <br />
                  Email: hello@plancktechnologies.xyz
                </p>
                <p className="text-muted-foreground">
                  Los datos personales son tratados con la finalidad de gestionar las solicitudes de acceso a la
                  plataforma y proporcionar servicios de computación cuántica.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Datos que Recopilamos</h2>
                <p className="text-muted-foreground">A través del formulario de registro, recopilamos:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Nombre completo (obligatorio)</li>
                  <li>Correo electrónico (obligatorio)</li>
                  <li>Teléfono de contacto (obligatorio)</li>
                  <li>País de residencia (obligatorio)</li>
                  <li>Ocupación profesional (obligatorio)</li>
                  <li>Contraseña cifrada (obligatorio)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. Finalidad del Tratamiento</h2>
                <p className="text-muted-foreground">Los datos personales recopilados serán utilizados para:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Gestionar el acceso a la plataforma de computación cuántica</li>
                  <li>Proporcionar soporte técnico y atención al cliente</li>
                  <li>Procesar pagos y gestionar suscripciones</li>
                  <li>Enviar notificaciones sobre el servicio</li>
                  <li>Mejorar nuestros servicios mediante análisis de uso</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Legitimación del Tratamiento</h2>
                <p className="text-muted-foreground">La base legal para el tratamiento es:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>
                    <strong>Artículo 6.1.b del RGPD:</strong> Ejecución de un contrato
                  </li>
                  <li>
                    <strong>Artículo 6.1.f del RGPD:</strong> Intereses legítimos del responsable
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Conservación de los Datos</h2>
                <p className="text-muted-foreground">
                  Los datos se conservarán mientras la cuenta esté activa y durante el tiempo necesario para cumplir
                  obligaciones legales (mínimo 5 años tras la cancelación del servicio).
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Comunicación de Datos</h2>
                <p className="text-muted-foreground">
                  No cedemos datos a terceros salvo obligación legal o para proveedores esenciales del servicio
                  (hosting, procesamiento de pagos) bajo acuerdos de confidencialidad.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Derechos del Usuario</h2>
                <p className="text-muted-foreground">Puede ejercer los siguientes derechos:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Derecho de acceso a sus datos personales</li>
                  <li>Derecho de rectificación de datos inexactos</li>
                  <li>Derecho de supresión ("derecho al olvido")</li>
                  <li>Derecho de limitación del tratamiento</li>
                  <li>Derecho de oposición al tratamiento</li>
                  <li>Derecho de portabilidad de datos</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Seguridad</h2>
                <p className="text-muted-foreground">
                  Implementamos medidas técnicas y organizativas de seguridad avanzadas, incluyendo cifrado SSL/TLS,
                  autenticación de dos factores, y almacenamiento seguro en bases de datos con Row Level Security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Contacto</h2>
                <p className="text-muted-foreground">
                  Para ejercer sus derechos o consultas sobre privacidad:
                  <br />
                  Email: hello@plancktechnologies.xyz
                  <br />
                  Asunto: "Protección de Datos Personales"
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Data Controller</h2>
                <p className="text-muted-foreground">
                  The data controller for personal data collected on this website is:
                  <br />
                  <strong>Planck Computing SaaS</strong>
                  <br />
                  Email: hello@plancktechnologies.xyz
                </p>
                <p className="text-muted-foreground">
                  Personal data is processed to manage platform access requests and provide quantum computing services.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Data We Collect</h2>
                <p className="text-muted-foreground">Through the registration form, we collect:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Full name (required)</li>
                  <li>Email address (required)</li>
                  <li>Phone number (required)</li>
                  <li>Country of residence (required)</li>
                  <li>Professional occupation (required)</li>
                  <li>Encrypted password (required)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. Purpose of Processing</h2>
                <p className="text-muted-foreground">Personal data will be used to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Manage access to the quantum computing platform</li>
                  <li>Provide technical support and customer service</li>
                  <li>Process payments and manage subscriptions</li>
                  <li>Send service notifications</li>
                  <li>Improve our services through usage analysis</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Legal Basis</h2>
                <p className="text-muted-foreground">The legal basis for processing is:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>
                    <strong>GDPR Article 6.1.b:</strong> Contract execution
                  </li>
                  <li>
                    <strong>GDPR Article 6.1.f:</strong> Legitimate interests of the controller
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Data Retention</h2>
                <p className="text-muted-foreground">
                  Data will be retained while the account is active and for the time necessary to comply with legal
                  obligations (minimum 5 years after service cancellation).
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Data Sharing</h2>
                <p className="text-muted-foreground">
                  We do not share data with third parties except when legally required or with essential service
                  providers (hosting, payment processing) under confidentiality agreements.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. User Rights</h2>
                <p className="text-muted-foreground">You can exercise the following rights:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Right to access your personal data</li>
                  <li>Right to rectify inaccurate data</li>
                  <li>Right to erasure ("right to be forgotten")</li>
                  <li>Right to restrict processing</li>
                  <li>Right to object to processing</li>
                  <li>Right to data portability</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Security</h2>
                <p className="text-muted-foreground">
                  We implement advanced technical and organizational security measures, including SSL/TLS encryption,
                  two-factor authentication, and secure database storage with Row Level Security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Contact</h2>
                <p className="text-muted-foreground">
                  To exercise your rights or privacy inquiries:
                  <br />
                  Email: hello@plancktechnologies.xyz
                  <br />
                  Subject: "Personal Data Protection"
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
