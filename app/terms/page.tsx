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
                <h2 className="text-2xl font-semibold mb-3">1. Identificación y Contacto</h2>
                <p className="text-muted-foreground">
                  Titular: <strong>Planck Computing SaaS</strong>
                  <br />
                  Email de contacto: <strong>hello@plancktechnologies.xyz</strong>
                  <br />
                  Actividad: Plataforma SaaS de computación cuántica en la nube
                  <br />
                  Dominio: plancktechnologies.xyz
                </p>
                <p className="text-muted-foreground mt-3">
                  Para cualquier consulta relacionada con estos términos, privacidad, o cuestiones técnicas, por favor
                  contacte a nuestro equipo en hello@plancktechnologies.xyz con el asunto correspondiente.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. Condiciones Generales de Uso</h2>
                <p className="text-muted-foreground">
                  El acceso y uso de este sitio web y sus servicios otorga la condición de USUARIO, que acepta de forma
                  expresa e íntegra las presentes Condiciones Generales de Uso. El USUARIO se compromete a utilizar el
                  sitio web, sus servicios y contenidos conforme a la ley vigente, la moral, el orden público y las
                  presentes Condiciones Generales.
                </p>
                <p className="text-muted-foreground mt-3">
                  Al registrarse en Planck, el usuario acepta recibir comunicaciones relacionadas con el servicio,
                  actualizaciones de productos y notificaciones técnicas necesarias para el correcto funcionamiento de
                  la plataforma.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. Responsabilidades y Obligaciones del Usuario</h2>
                <p className="text-muted-foreground">El USUARIO se compromete expresamente a:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>No realizar acciones que dañen, inutilicen, sobrecarguen o deterioren la plataforma</li>
                  <li>No introducir, difundir o ejecutar virus informáticos, malware o cualquier código malicioso</li>
                  <li>No intentar acceder a áreas restringidas del sistema o a cuentas de otros usuarios</li>
                  <li>Usar los recursos de computación cuántica de forma responsable y ética</li>
                  <li>Respetar estrictamente los límites de uso establecidos en su plan de suscripción</li>
                  <li>No compartir credenciales de acceso con terceros no autorizados</li>
                  <li>Mantener la confidencialidad de sus claves API y tokens de autenticación</li>
                  <li>No utilizar la plataforma para actividades ilegales o no autorizadas</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  El incumplimiento de estas obligaciones puede resultar en la suspensión temporal o permanente de la
                  cuenta sin previo aviso.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Derechos de Propiedad Intelectual</h2>
                <p className="text-muted-foreground">
                  Todos los contenidos del sitio web, incluyendo pero no limitándose a: diseño gráfico, código fuente,
                  logotipos, textos, gráficos, ilustraciones, fotografías, marcas, nombres comerciales, software,
                  algoritmos cuánticos y cualquier otro signo distintivo, son propiedad exclusiva de Planck o contamos
                  con las licencias correspondientes para su uso.
                </p>
                <p className="text-muted-foreground mt-3">
                  Queda estrictamente prohibida la reproducción total o parcial, distribución, comunicación pública,
                  transformación o cualquier otra forma de explotación sin la autorización expresa y por escrito de
                  Planck. Los circuitos cuánticos y algoritmos desarrollados por los usuarios permanecen como propiedad
                  del usuario, otorgando a Planck únicamente los derechos necesarios para ejecutar y procesar dichos
                  circuitos.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Limitación de Responsabilidad y Garantías</h2>
                <p className="text-muted-foreground">Planck no se hace responsable de los siguientes aspectos:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>
                    Interrupciones temporales del servicio derivadas de mantenimiento programado, actualizaciones de
                    sistema o causas técnicas imprevistas
                  </li>
                  <li>
                    Exactitud, precisión o fiabilidad de los resultados de cálculos cuánticos (todos los resultados se
                    proporcionan "tal cual" sin garantías)
                  </li>
                  <li>Pérdida de datos causada por eventos fuera de nuestro control razonable</li>
                  <li>
                    Errores en la configuración, diseño o implementación de circuitos cuánticos creados por el usuario
                  </li>
                  <li>Disponibilidad continua de backends cuánticos de terceros</li>
                  <li>Daños indirectos, consecuenciales o pérdidas de beneficios derivados del uso de la plataforma</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Planck implementa medidas de seguridad estándar de la industria, pero no garantiza la inmunidad
                  absoluta contra accesos no autorizados o pérdida de datos. Los usuarios son responsables de mantener
                  copias de seguridad de su información crítica.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Tratamiento de Datos en la Nube</h2>
                <p className="text-muted-foreground">
                  Todos los datos procesados a través de Planck Computing SaaS son tratados y almacenados en
                  infraestructura cloud segura. Los datos del usuario, incluyendo circuitos cuánticos, configuraciones,
                  resultados de ejecución y métricas de rendimiento, se almacenan en servidores cloud con cifrado en
                  tránsito y en reposo.
                </p>
                <p className="text-muted-foreground mt-3">
                  Implementamos las siguientes medidas de seguridad para proteger sus datos:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>Cifrado TLS/SSL para todas las comunicaciones</li>
                  <li>Cifrado de datos en reposo en bases de datos</li>
                  <li>Controles de acceso basados en roles (RBAC)</li>
                  <li>Auditoría y registro de accesos a datos sensibles</li>
                  <li>Copias de seguridad automáticas y redundancia geográfica</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Los datos pueden ser procesados en múltiples regiones geográficas para optimizar rendimiento y
                  disponibilidad. Para más información sobre el tratamiento de datos personales, consulte nuestra
                  Política de Privacidad.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Recopilación de Datos para Mejora de Modelos</h2>
                <p className="text-muted-foreground">
                  Por defecto, Planck recopila datos anonimizados de benchmarks, patrones de uso y métricas de ejecución
                  de circuitos cuánticos con el propósito exclusivo de mejorar nuestros algoritmos, optimizar backends y
                  perfeccionar la experiencia de usuario. Esta recopilación incluye:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Tiempos de ejecución de circuitos y mediciones de fidelidad cuántica</li>
                  <li>Benchmarks de rendimiento de diferentes backends (GPU, QPU, HPC)</li>
                  <li>Patrones de optimización de algoritmos y configuraciones exitosas</li>
                  <li>Estadísticas agregadas de uso de recursos computacionales</li>
                  <li>Métricas de error y tasas de éxito de ejecuciones</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Los usuarios pueden desactivar esta recopilación de datos en cualquier momento a través del
                  interruptor "Improve Models" en la sección Configuración → Preferencias de su cuenta. Una vez
                  desactivado, no se recopilarán nuevos datos, aunque los datos previamente anonimizados pueden
                  permanecer en nuestros sistemas de análisis.
                </p>
                <p className="text-muted-foreground mt-3">
                  Importante: No se recopila información de identificación personal a través de este sistema, y todos
                  los datos son tratados exclusivamente de forma agregada y anónima en conformidad con el GDPR y nuestra
                  Política de Privacidad.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Planes de Suscripción y Facturación</h2>
                <p className="text-muted-foreground">
                  Planck ofrece diferentes niveles de suscripción (Starter, Pro, Custom) con límites específicos de
                  recursos. Los usuarios son responsables de seleccionar el plan adecuado para sus necesidades y de
                  mantener información de pago actualizada.
                </p>
                <p className="text-muted-foreground mt-3">
                  La facturación se realiza mensualmente por adelantado. Los usuarios pueden cambiar o cancelar su plan
                  en cualquier momento, con cambios efectivos al inicio del siguiente período de facturación. No se
                  ofrecen reembolsos parciales por servicios no utilizados dentro de un período de facturación.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Modificaciones de los Términos</h2>
                <p className="text-muted-foreground">
                  Nos reservamos el derecho de modificar las presentes Condiciones de Uso en cualquier momento. Los
                  cambios sustanciales se notificarán a los usuarios registrados por correo electrónico con al menos 15
                  días de antelación. Las modificaciones menores entrarán en vigor inmediatamente tras su publicación en
                  esta página.
                </p>
                <p className="text-muted-foreground mt-3">
                  El uso continuado de la plataforma tras la notificación de cambios constituye la aceptación de los
                  términos modificados.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">10. Legislación Aplicable y Jurisdicción</h2>
                <p className="text-muted-foreground">
                  Las presentes condiciones se rigen e interpretan de acuerdo con la legislación española vigente. Para
                  la resolución de cualquier controversia o conflicto derivado de estos términos o del uso de la
                  plataforma, las partes se someten expresamente a los Juzgados y Tribunales de Barcelona, España,
                  renunciando a cualquier otro fuero que pudiera corresponderles.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">11. Contacto y Consultas</h2>
                <p className="text-muted-foreground">
                  Para cualquier consulta, duda o comentario relacionado con este Aviso Legal, las condiciones de uso o
                  el funcionamiento de la plataforma, puede contactar con nosotros a través de:
                  <br />
                  <br />
                  Email: <strong>hello@plancktechnologies.xyz</strong>
                  <br />
                  Asunto recomendado: "Consulta Legal - [tema específico]"
                  <br />
                  <br />
                  Tiempo de respuesta estimado: 48-72 horas laborables
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2 className="text-2xl font-semibold mb-3">1. Identification and Contact</h2>
                <p className="text-muted-foreground">
                  Owner: <strong>Planck Computing SaaS</strong>
                  <br />
                  Contact Email: <strong>hello@plancktechnologies.xyz</strong>
                  <br />
                  Activity: Cloud-based quantum computing SaaS platform
                  <br />
                  Domain: plancktechnologies.xyz
                </p>
                <p className="text-muted-foreground mt-3">
                  For any inquiries related to these terms, privacy, or technical matters, please contact our team at
                  hello@plancktechnologies.xyz with the appropriate subject line.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">2. General Terms of Use</h2>
                <p className="text-muted-foreground">
                  Access and use of this website and its services grants USER status, which expressly and fully accepts
                  these General Terms of Use. The USER agrees to use the website, services, and content in accordance
                  with applicable law, morality, public order, and these General Terms.
                </p>
                <p className="text-muted-foreground mt-3">
                  By registering with Planck, users agree to receive service-related communications, product updates,
                  and technical notifications necessary for proper platform functionality.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">3. User Responsibilities and Obligations</h2>
                <p className="text-muted-foreground">The USER expressly agrees to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Not perform actions that damage, disable, overload, or deteriorate the platform</li>
                  <li>Not introduce, distribute, or execute computer viruses, malware, or malicious code</li>
                  <li>Not attempt to access restricted system areas or other users' accounts</li>
                  <li>Use quantum computing resources responsibly and ethically</li>
                  <li>Strictly respect usage limits established in their subscription plan</li>
                  <li>Not share access credentials with unauthorized third parties</li>
                  <li>Maintain confidentiality of API keys and authentication tokens</li>
                  <li>Not use the platform for illegal or unauthorized activities</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Failure to comply with these obligations may result in temporary or permanent account suspension
                  without prior notice.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">4. Intellectual Property Rights</h2>
                <p className="text-muted-foreground">
                  All website content, including but not limited to: graphic design, source code, logos, texts,
                  graphics, illustrations, photographs, trademarks, trade names, software, quantum algorithms, and any
                  other distinctive signs, are the exclusive property of Planck or we have the corresponding licenses
                  for their use.
                </p>
                <p className="text-muted-foreground mt-3">
                  Total or partial reproduction, distribution, public communication, transformation, or any other form
                  of exploitation is strictly prohibited without the express written authorization of Planck. Quantum
                  circuits and algorithms developed by users remain the property of the user, granting Planck only the
                  rights necessary to execute and process said circuits.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">5. Limitation of Liability and Warranties</h2>
                <p className="text-muted-foreground">Planck is not responsible for the following aspects:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>
                    Temporary service interruptions resulting from scheduled maintenance, system updates, or unforeseen
                    technical issues
                  </li>
                  <li>
                    Accuracy, precision, or reliability of quantum calculation results (all results provided "as is"
                    without warranties)
                  </li>
                  <li>Data loss caused by events beyond our reasonable control</li>
                  <li>Errors in configuration, design, or implementation of user-created quantum circuits</li>
                  <li>Continuous availability of third-party quantum backends</li>
                  <li>Indirect, consequential damages, or loss of profits derived from platform use</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Planck implements industry-standard security measures but does not guarantee absolute immunity against
                  unauthorized access or data loss. Users are responsible for maintaining backups of their critical
                  information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">6. Cloud Data Processing</h2>
                <p className="text-muted-foreground">
                  All data processed through Planck Computing SaaS is handled and stored in secure cloud infrastructure.
                  User data, including quantum circuits, configurations, execution results, and performance metrics, is
                  stored on cloud servers containing PlanckDB with encryption in transit and at rest.
                </p>
                <p className="text-muted-foreground mt-3">
                  We implement the following security measures to protect your data:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                  <li>TLS/SSL encryption for all communications</li>
                  <li>Encryption of data in databases</li>
                  <li>Role-based access controls (RBAC)</li>
                  <li>Auditing and logging of sensitive data access</li>
                  <li>Automatic backups and geographic redundancies across eu-west providersS</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Data may be processed across multiple geographic regions to optimize performance and availability. For
                  more information about personal data processing, please refer to our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">7. Data Collection for Model Improvement</h2>
                <p className="text-muted-foreground">
                  By default, Planck collects benchmark data, usage patterns, and quantum circuit execution
                  metrics for the exclusive purpose of improving our algorithms, optimizing backends, and enhancing user
                  experience. This collection includes:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Circuit execution times and quantum fidelity measurements</li>
                  <li>Performance benchmarks of different backends (GPU, QPU, HPC)</li>
                  <li>Algorithm optimization patterns and successful configurations</li>
                  <li>Aggregated computational resource usage statistics</li>
                  <li>Error metrics and execution success rates</li>
                </ul>
                <p className="text-muted-foreground mt-3">
                  Users may opt-out of this data collection at any time through the "Improve Models" toggle in Settings
                  → Preferences section of their account. Once disabled, no new data will be collected, although
                  previously anonymized data may remain in our analysis systems.
                </p>
                <p className="text-muted-foreground mt-3">
                  Important: No personally identifiable information is collected through this system, and all data is
                  treated exclusively in aggregated and anonymous form in compliance with GDPR and our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">8. Subscription Plans and Billing</h2>
                <p className="text-muted-foreground">
                  Planck offers different subscription tiers (Starter, Pro, Custom) with specific resource limits. Users
                  are responsible for selecting the appropriate plan for their needs and maintaining updated payment
                  information.
                </p>
                <p className="text-muted-foreground mt-3">
                  Billing occurs monthly in advance. Users may change or cancel their plan at any time, with changes
                  effective at the start of the next billing period. No partial refunds are offered for unused services
                  within a billing period.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">9. Terms Modifications</h2>
                <p className="text-muted-foreground">
                  We reserve the right to modify these Terms of Use at any time. Substantial changes will be notified to
                  registered users by email. Minor modifications will take effect
                  immediately upon publication on this page.
                </p>
                <p className="text-muted-foreground mt-3">
                  Continued use of the platform after notification of changes constitutes acceptance of the modified
                  terms.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">10. Applicable Law and Jurisdiction</h2>
                <p className="text-muted-foreground">
                  These conditions are governed and interpreted in accordance with current Spanish legislation. For the
                  resolution of any controversy or conflict arising from these terms or platform use, the parties
                  expressly submit to the Courts and Tribunals of Barcelona, Spain, waiving any other jurisdiction that
                  may correspond to them.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-3">11. Contact and Inquiries</h2>
                <p className="text-muted-foreground">
                  For any questions, doubts, or comments related to this Legal Notice, terms of use, or platform
                  operation, you can contact us through:
                  <br />
                  <br />
                  Email: <strong>hello@plancktechnologies.xyz</strong>
                  <br />
                  Recommended subject: "Legal Inquiry - [specific topic]"
                  <br />
                  <br />
                  Estimated response time: 48-72 business hours
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
