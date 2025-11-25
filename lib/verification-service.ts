// Email and SMS verification service
// In production, integrate with services like SendGrid, Twilio, etc.

interface VerificationCode {
  code: string
  email: string
  phone?: string
  timestamp: number
  method: "email" | "sms"
}

const VERIFICATION_KEY = "planck_verification_codes"
const CODE_EXPIRY = 10 * 60 * 1000 // 10 minutes

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function sendVerificationEmail(email: string): Promise<string> {
  const code = generateCode()

  // Store code temporarily
  storeVerificationCode(code, email, "email")

  // In production, send actual email using SendGrid or similar
  console.log(`[Planck] Verification code for ${email}: ${code}`)

  // Simulate email sending (in production, use real email service)
  try {
    // Example with SendGrid (commented out for preview):
    // await fetch('/api/send-email', {
    //   method: 'POST',
    //   body: JSON.stringify({ email, code })
    // })

    return code
  } catch (error) {
    throw new Error("Failed to send verification email")
  }
}

export async function sendVerificationSMS(phone: string, email: string): Promise<string> {
  const code = generateCode()

  // Store code temporarily
  storeVerificationCode(code, email, "sms", phone)

  // In production, send actual SMS using Twilio or similar
  console.log(`[Planck] SMS verification code for ${phone}: ${code}`)

  // Simulate SMS sending (in production, use real SMS service)
  try {
    // Example with Twilio (commented out for preview):
    // await fetch('/api/send-sms', {
    //   method: 'POST',
    //   body: JSON.stringify({ phone, code })
    // })

    return code
  } catch (error) {
    throw new Error("Failed to send verification SMS")
  }
}

function storeVerificationCode(code: string, email: string, method: "email" | "sms", phone?: string): void {
  if (typeof window === "undefined") return

  const verification: VerificationCode = {
    code,
    email,
    phone,
    timestamp: Date.now(),
    method,
  }

  localStorage.setItem(VERIFICATION_KEY, JSON.stringify(verification))
}

export function verifyCode(enteredCode: string, email: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const stored = localStorage.getItem(VERIFICATION_KEY)
    if (!stored) return false

    const verification: VerificationCode = JSON.parse(stored)

    // Check if code is expired
    if (Date.now() - verification.timestamp > CODE_EXPIRY) {
      localStorage.removeItem(VERIFICATION_KEY)
      return false
    }

    // Check if code and email match
    if (verification.code === enteredCode && verification.email === email) {
      localStorage.removeItem(VERIFICATION_KEY)
      return true
    }

    return false
  } catch {
    return false
  }
}
