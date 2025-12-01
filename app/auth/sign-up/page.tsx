"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useRef, useEffect } from "react"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSelector } from "@/components/language-selector"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"
import { sendVerificationEmail } from "@/lib/verification-service"
import { useLanguage } from "@/contexts/language-context"
import { Eye, EyeOff } from "lucide-react"

const COUNTRY_CODES: { [key: string]: string } = {
  Argentina: "+54",
  Australia: "+61",
  Austria: "+43",
  Belgium: "+32",
  Brazil: "+55",
  Canada: "+1",
  Chile: "+56",
  Colombia: "+57",
  Denmark: "+45",
  France: "+33",
  Germany: "+49",
  India: "+91",
  Ireland: "+353",
  Italy: "+39",
  Japan: "+81",
  Mexico: "+52",
  Netherlands: "+31",
  "New Zealand": "+64",
  Norway: "+47",
  Poland: "+48",
  Portugal: "+351",
  Russia: "+7",
  Singapore: "+65",
  "South Korea": "+82",
  Spain: "+34",
  Sweden: "+46",
  Switzerland: "+41",
  "United Kingdom": "+44",
  "United States": "+1",
  Other: "+1",
}

const COUNTRIES = [
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "Colombia",
  "Denmark",
  "France",
  "Germany",
  "India",
  "Ireland",
  "Italy",
  "Japan",
  "Mexico",
  "Netherlands",
  "New Zealand",
  "Norway",
  "Poland",
  "Portugal",
  "Russia",
  "Singapore",
  "South Korea",
  "Spain",
  "Sweden",
  "Switzerland",
  "United Kingdom",
  "United States",
  "Other",
]

const OCCUPATIONS = [
  { value: "student", label: "Student" },
  { value: "researcher", label: "Researcher" },
  { value: "employee", label: "Company Employee" },
  { value: "other", label: "Other" },
]

export default function SignUpPage() {
  const { language } = useLanguage()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [country, setCountry] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [occupation, setOccupation] = useState("")
  const [organization, setOrganization] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false)
  const termsRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const phonePrefix = country ? COUNTRY_CODES[country] : ""

  useEffect(() => {
    const termsContainer = termsRef.current
    if (!termsContainer) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = termsContainer
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        setHasScrolledTerms(true)
      }
    }

    termsContainer.addEventListener("scroll", handleScroll)
    return () => termsContainer.removeEventListener("scroll", handleScroll)
  }, [])

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (!termsAccepted) {
      setError(
        language === "es" ? "Debes aceptar los términos y condiciones" : "You must accept the terms and conditions",
      )
      setIsLoading(false)
      return
    }

    if (password !== repeatPassword) {
      setError(language === "es" ? "Las contraseñas no coinciden" : "Passwords do not match")
      setIsLoading(false)
      return
    }

    if (!country || !occupation) {
      setError(language === "es" ? "Por favor selecciona país y ocupación" : "Please select country and occupation")
      setIsLoading(false)
      return
    }

    if (!phoneNumber) {
      setError(language === "es" ? "El número de teléfono es obligatorio" : "Phone number is required")
      setIsLoading(false)
      return
    }

    if (!firstName || !lastName) {
      setError(language === "es" ? "Nombre y apellido son obligatorios" : "First name and last name are required")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const fullPhone = `${phonePrefix}${phoneNumber}`
      const fullName = `${firstName} ${lastName}`

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/qsaas/dashboard`,
          data: {
            name: fullName,
            first_name: firstName,
            last_name: lastName,
            country,
            country_code: phonePrefix,
            phone_number: phoneNumber,
            occupation,
            organization,
          },
        },
      })

      if (signUpError) throw signUpError

      document.cookie = `planck_session=active; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Strict`

      await sendVerificationEmail(email)

      await new Promise((resolve) => setTimeout(resolve, 500))
      router.push(`/auth/verify-code?email=${encodeURIComponent(email)}&phone=${encodeURIComponent(fullPhone)}`)
    } catch (error: unknown) {
      console.error("Sign up error:", error)
      setError(error instanceof Error ? error.message : language === "es" ? "Ocurrió un error" : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full max-w-2xl px-4">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/isotipo-20planck-20png.png"
            alt="Planck"
            width={40}
            height={40}
            className="object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-2xl">{language === "es" ? "Crear Cuenta" : "Create Account"}</CardTitle>
          <CardDescription>
            {language === "es"
              ? "Únete a Planck y comienza con computación cuántica"
              : "Join Planck and start quantum computing"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  {language === "es" ? "Nombre" : "First Name"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder={language === "es" ? "Juan" : "John"}
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={isLoading}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">
                  {language === "es" ? "Apellido" : "Last Name"} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder={language === "es" ? "García" : "Smith"}
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={isLoading}
                  className="bg-input border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                {language === "es" ? "Correo Electrónico" : "Email"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {language === "es" ? "Contraseña" : "Password"} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-input border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repeat-password">
                {language === "es" ? "Confirmar Contraseña" : "Confirm Password"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="repeat-password"
                  type={showRepeatPassword ? "text" : "password"}
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-input border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showRepeatPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">
                {language === "es" ? "País de Residencia" : "Country of Residence"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select value={country} onValueChange={setCountry} disabled={isLoading} required>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder={language === "es" ? "Selecciona país" : "Select country"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                {language === "es" ? "Número de Teléfono" : "Phone Number"} <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={phonePrefix}
                  disabled
                  className="w-20 bg-muted border-border text-center"
                  placeholder="+X"
                />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="1234567890"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  disabled={isLoading || !country}
                  className="flex-1 bg-input border-border"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupation">
                {language === "es" ? "¿Cuál es tu rol?" : "What's your role?"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select value={occupation} onValueChange={setOccupation} disabled={isLoading} required>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue placeholder={language === "es" ? "Selecciona tu rol" : "Select your role"} />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {OCCUPATIONS.map((occ) => (
                    <SelectItem key={occ.value} value={occ.value}>
                      {occ.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">
                {language === "es" ? "Nombre de Organización" : "Organization Name"}
                <span className="text-muted-foreground text-xs ml-2">
                  ({language === "es" ? "Opcional" : "Optional"})
                </span>
              </Label>
              <Input
                id="organization"
                type="text"
                placeholder={language === "es" ? "Universidad de Barcelona" : "Stanford University"}
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                disabled={isLoading}
                className="bg-input border-border"
              />
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <Label>{language === "es" ? "Términos y Condiciones" : "Terms and Conditions"}</Label>
              <div
                ref={termsRef}
                className="h-48 overflow-y-auto p-4 border border-border rounded-lg bg-secondary/30 text-sm text-muted-foreground space-y-3"
              >
                {language === "es" ? (
                  <>
                    <p className="font-semibold text-foreground">Aviso Legal - Planck Quantum SaaS</p>
                    <p>
                      <strong>1. Identificación:</strong> Planck Quantum SaaS - Email: hello@plancktechnologies.xyz -
                      Actividad: Plataforma SaaS de computación cuántica en la nube
                    </p>
                    <p>
                      <strong>2. Condiciones de Uso:</strong> El acceso y uso otorga condición de USUARIO que acepta
                      estas Condiciones. El usuario se compromete a usar el sitio conforme a ley, moral y orden público.
                    </p>
                    <p>
                      <strong>3. Responsabilidades:</strong> No dañar la plataforma, no introducir virus, no acceder a
                      áreas restringidas, usar recursos responsablemente, respetar límites de suscripción, no compartir
                      credenciales.
                    </p>
                    <p>
                      <strong>4. Propiedad Intelectual:</strong> Todos los contenidos son propiedad de Planck. Prohibida
                      reproducción sin autorización. Los circuitos del usuario permanecen como propiedad del usuario.
                    </p>
                    <p>
                      <strong>5. Limitación de Responsabilidad:</strong> Planck no se hace responsable de interrupciones
                      del servicio, resultados cuánticos (ofrecidos "tal cual"), pérdida de datos, errores en circuitos
                      del usuario.
                    </p>
                    <p>
                      <strong>6. Tratamiento de Datos en la Nube:</strong> Todos los datos se procesan y almacenan en
                      infraestructura cloud segura con cifrado en tránsito y reposo. Implementamos TLS/SSL, cifrado de
                      datos, controles de acceso RBAC, auditoría y copias de seguridad.
                    </p>
                    <p>
                      <strong>7. Mejora de Modelos:</strong> Por defecto, recopilamos datos anonimizados de benchmarks y
                      métricas para mejorar algoritmos. Desactivable en Configuración → Preferencias. No se recopila
                      información personal identificable.
                    </p>
                    <p>
                      <strong>8. Suscripciones:</strong> Diferentes planes con límites específicos. Facturación mensual
                      adelantada. Cambios efectivos al siguiente período.
                    </p>
                    <p>
                      <strong>9. Modificaciones:</strong> Nos reservamos el derecho de modificar los Términos. Cambios
                      sustanciales notificados por email con 15 días de antelación.
                    </p>
                    <p>
                      <strong>10. Legislación:</strong> Regido por legislación española. Jurisdicción: Tribunales de
                      Barcelona.
                    </p>
                    <p>
                      <strong>11. Contacto:</strong> Para consultas: hello@plancktechnologies.xyz - Respuesta: 48-72h
                      laborables
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-foreground">Legal Notice - Planck Computing SaaS</p>
                    <p>
                      <strong>1. Identification:</strong> Planck Computing SaaS - Email: hello@plancktechnologies.xyz -
                      Activity: Cloud-based quantum computing SaaS platform
                    </p>
                    <p>
                      <strong>2. Terms of Use:</strong> Access and use grants USER status accepting these Terms. User
                      agrees to use site in accordance with law, morality, and public order.
                    </p>
                    <p>
                      <strong>3. Responsibilities:</strong> Not damage platform, not introduce viruses, not access
                      restricted areas, use resources responsibly, respect subscription limits, not share credentials.
                    </p>
                    <p>
                      <strong>4. Intellectual Property:</strong> All content owned by Planck. Reproduction prohibited
                      without authorization. User circuits remain user property.
                    </p>
                    <p>
                      <strong>5. Limitation of Liability:</strong> Planck not responsible for service interruptions,
                      quantum results (provided "as is"), data loss, user circuit errors.
                    </p>
                    <p>
                      <strong>6. Cloud Data Processing:</strong> All data processed and stored in secure cloud
                      infrastructure with encryption in transit and at rest. We implement TLS/SSL, data encryption, RBAC
                      access controls, auditing, and backups.
                    </p>
                    <p>
                      <strong>7. Model Improvement:</strong> By default, we collect anonymized benchmark data and
                      metrics to improve algorithms. Opt-out in Settings → Preferences. No personally identifiable
                      information collected.
                    </p>
                    <p>
                      <strong>8. Subscriptions:</strong> Different plans with specific limits. Monthly billing in
                      advance. Changes effective next period.
                    </p>
                    <p>
                      <strong>9. Modifications:</strong> We reserve right to modify Terms. Substantial changes notified
                      by email.
                    </p>
                    <p>
                      <strong>10. Law:</strong> Governed by Spanish law. Jurisdiction: Courts of Barcelona.
                    </p>
                    <p>
                      <strong>11. Contact:</strong> For inquiries: hello@plancktechnologies.xyz - Response: 48-72
                      business hours
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  disabled={!hasScrolledTerms || isLoading}
                  className="mt-1"
                />
                <Label
                  htmlFor="terms"
                  className={`text-sm cursor-pointer ${!hasScrolledTerms ? "text-muted-foreground/50" : ""}`}
                >
                  {language === "es"
                    ? "He leído y acepto los términos y condiciones"
                    : "I have read and accept the terms and conditions"}
                  {!hasScrolledTerms && (
                    <span className="block text-xs text-muted-foreground mt-1">
                      {language === "es"
                        ? "(Desplázate hasta el final para habilitar)"
                        : "(Scroll to the bottom to enable)"}
                    </span>
                  )}
                </Label>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              disabled={isLoading || !termsAccepted}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  {language === "es" ? "Creando cuenta..." : "Creating account..."}
                </div>
              ) : language === "es" ? (
                "Crear Cuenta"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {language === "es" ? "¿Ya tienes una cuenta? " : "Already have an account? "}
            <Link href="/auth/login" className="text-primary hover:underline">
              {language === "es" ? "Inicia sesión" : "Sign in"}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
