/**
 * Security utilities for API protection
 * Provides input validation, sanitization, and protection against common attacks
 */

// Regex patterns for validation
const PATTERNS = {
  // API key: Pure alphanumeric (hex), 64 chars (v0.9 format)
  // Legacy format also supported: alphanumeric with underscores/hyphens, 10-200 chars
  API_KEY: /^[a-fA-F0-9]{64}$|^[a-zA-Z0-9_-]{10,200}$/,
  // UUID format
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // Algorithm names: alphanumeric, 1-50 chars
  ALGORITHM: /^[a-zA-Z0-9_-]{1,50}$/,
  // Circuit name: alphanumeric with spaces, hyphens, underscores
  CIRCUIT_NAME: /^[a-zA-Z0-9\s_-]{1,100}$/,
  // Backend name
  BACKEND: /^[a-zA-Z0-9_-]{1,50}$/,
  // SQL injection patterns to detect
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|EXEC|EXECUTE|CREATE|TRUNCATE)\b)|(--)|(;)|(\x00)/i,
  // XSS patterns to detect
  XSS: /<script|javascript:|on\w+\s*=|<iframe|<object|<embed|<svg\s+onload/i,
}

// Allowed algorithms
const ALLOWED_ALGORITHMS = new Set([
  'bell', 'Bell',
  'grover', 'Grover',
  'shor', 'Shor',
  'vqe', 'VQE',
  'qaoa', 'QAOA',
  'qft', 'QFT',
])

// Allowed backends
const ALLOWED_BACKENDS = new Set([
  'auto',
  'classical',
  'hpc',
  'hpc_gpu',
  'quantum_qpu',
  'quantum_inspired_gpu',
])

// Allowed error mitigation levels
const ALLOWED_ERROR_MITIGATION = new Set([
  'none',
  'low',
  'medium',
  'high',
  'basic',
  'advanced',
])

/**
 * Validate API key format
 */
export function validateApiKey(apiKey: string | null): boolean {
  if (!apiKey || typeof apiKey !== 'string') return false
  return PATTERNS.API_KEY.test(apiKey)
}

/**
 * Validate UUID format
 */
export function validateUUID(uuid: string | null): boolean {
  if (!uuid || typeof uuid !== 'string') return false
  return PATTERNS.UUID.test(uuid)
}

/**
 * Validate algorithm name
 */
export function validateAlgorithm(algorithm: string | null): string {
  if (!algorithm || typeof algorithm !== 'string') return 'VQE'
  
  const normalized = algorithm.trim()
  if (!ALLOWED_ALGORITHMS.has(normalized)) {
    return 'VQE'
  }
  
  // Normalize to standard casing
  const algorithmMap: Record<string, string> = {
    'bell': 'Bell',
    'grover': 'Grover',
    'shor': 'Shor',
    'vqe': 'VQE',
    'qaoa': 'QAOA',
    'qft': 'QFT',
  }
  
  return algorithmMap[normalized.toLowerCase()] || normalized
}

/**
 * Validate backend name
 */
export function validateBackend(backend: string | null): string {
  if (!backend || typeof backend !== 'string') return 'auto'
  
  const normalized = backend.trim().toLowerCase()
  if (!ALLOWED_BACKENDS.has(normalized)) {
    return 'auto'
  }
  
  return normalized
}

/**
 * Validate error mitigation level
 */
export function validateErrorMitigation(level: string | null): string {
  if (!level || typeof level !== 'string') return 'medium'
  
  const normalized = level.trim().toLowerCase()
  if (!ALLOWED_ERROR_MITIGATION.has(normalized)) {
    return 'medium'
  }
  
  return normalized
}

/**
 * Sanitize string input - removes potential injection attacks
 */
export function sanitizeString(input: string | null | undefined, maxLength: number = 1000): string {
  if (!input || typeof input !== 'string') return ''
  
  // Check for SQL injection patterns
  if (PATTERNS.SQL_INJECTION.test(input)) {
    console.warn('[Security] Potential SQL injection detected and sanitized')
    input = input.replace(PATTERNS.SQL_INJECTION, '')
  }
  
  // Check for XSS patterns
  if (PATTERNS.XSS.test(input)) {
    console.warn('[Security] Potential XSS detected and sanitized')
    input = input.replace(PATTERNS.XSS, '')
  }
  
  // HTML entity encode special characters
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  }
  
  let sanitized = input
  for (const [char, entity] of Object.entries(htmlEntities)) {
    sanitized = sanitized.replace(new RegExp(char, 'g'), entity)
  }
  
  // Truncate to max length
  return sanitized.slice(0, maxLength)
}

/**
 * Validate and sanitize circuit name
 */
export function sanitizeCircuitName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return `Circuit-${Date.now()}`
  
  // Remove any potentially dangerous characters
  const sanitized = name.replace(/[^a-zA-Z0-9\s_-]/g, '').trim()
  
  if (sanitized.length === 0) {
    return `Circuit-${Date.now()}`
  }
  
  return sanitized.slice(0, 100)
}

/**
 * Validate numeric input within bounds
 */
export function validateNumber(
  value: number | null | undefined,
  min: number,
  max: number,
  defaultValue: number
): number {
  if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
    return defaultValue
  }
  
  return Math.max(min, Math.min(max, Math.floor(value)))
}

/**
 * Validate qubits count
 */
export function validateQubits(qubits: number | null | undefined): number {
  return validateNumber(qubits, 1, 30, 4)
}

/**
 * Validate shots count
 */
export function validateShots(shots: number | null | undefined): number {
  return validateNumber(shots, 1, 100000, 1024)
}

/**
 * Validate circuit depth
 */
export function validateDepth(depth: number | null | undefined): number {
  return validateNumber(depth, 1, 1000, 10)
}

/**
 * Validate gate count
 */
export function validateGateCount(count: number | null | undefined): number {
  return validateNumber(count, 0, 10000, 0)
}

/**
 * Validate QASM code - basic structure validation
 */
export function validateQASM(qasm: string | null | undefined): { valid: boolean; error?: string } {
  if (!qasm || typeof qasm !== 'string') {
    return { valid: false, error: 'QASM code is required' }
  }
  
  // Check minimum length
  if (qasm.length < 10) {
    return { valid: false, error: 'QASM code is too short' }
  }
  
  // Check maximum length (prevent DoS)
  if (qasm.length > 100000) {
    return { valid: false, error: 'QASM code is too large (max 100KB)' }
  }
  
  // Check for OPENQASM header (optional but recommended)
  const hasHeader = qasm.includes('OPENQASM') || qasm.includes('qreg')
  if (!hasHeader) {
    return { valid: false, error: 'Invalid QASM: missing OPENQASM header or qreg declaration' }
  }
  
  // Check for potential code injection in QASM
  const dangerousPatterns = [
    /import\s+os/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /__import__/i,
    /subprocess/i,
    /system\s*\(/i,
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(qasm)) {
      return { valid: false, error: 'Invalid QASM: contains disallowed patterns' }
    }
  }
  
  return { valid: true }
}

/**
 * Validate input data - checks structure and size
 */
export function validateInputData(data: any): { valid: boolean; error?: string; data?: any } {
  if (data === null || data === undefined) {
    return { valid: true, data: [] }
  }
  
  // Check if it's a valid type
  if (typeof data !== 'object' && !Array.isArray(data)) {
    return { valid: false, error: 'Input data must be an array or object' }
  }
  
  // Check size
  const dataString = JSON.stringify(data)
  if (dataString.length > 1024 * 1024) { // 1MB
    return { valid: false, error: 'Input data too large (max 1MB)' }
  }
  
  // Check array length
  if (Array.isArray(data) && data.length > 10000) {
    return { valid: false, error: 'Input data array too large (max 10,000 elements)' }
  }
  
  return { valid: true, data }
}

/**
 * Redact sensitive information from error messages
 */
export function redactSensitiveInfo(message: string): string {
  if (!message || typeof message !== 'string') return ''
  
  // Redact potential API keys
  let redacted = message.replace(/[a-zA-Z0-9_-]{20,}/g, '[REDACTED]')
  
  // Redact potential UUIDs
  redacted = redacted.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
  
  // Redact email addresses
  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
  
  return redacted
}

/**
 * Create a safe error response that doesn't leak internal details
 */
export function createSafeErrorResponse(error: unknown, fallbackMessage: string = 'An error occurred'): string {
  if (error instanceof Error) {
    // Don't expose internal error details
    const safeMessages: Record<string, string> = {
      'PGRST': 'Database operation failed',
      'ECONNREFUSED': 'Service temporarily unavailable',
      'ETIMEDOUT': 'Request timed out',
      'JWT': 'Authentication failed',
    }
    
    for (const [pattern, message] of Object.entries(safeMessages)) {
      if (error.message.includes(pattern)) {
        return message
      }
    }
    
    return redactSensitiveInfo(error.message).slice(0, 200)
  }
  
  return fallbackMessage
}

/**
 * Validate request headers for common security issues
 */
export function validateRequestHeaders(headers: Headers): { valid: boolean; error?: string } {
  // Check content-type for POST requests
  const contentType = headers.get('content-type')
  if (contentType && !contentType.includes('application/json')) {
    // Allow but warn
    console.warn('[Security] Non-JSON content type:', contentType)
  }
  
  // Check for suspicious user agents
  const userAgent = headers.get('user-agent') || ''
  const suspiciousAgents = ['sqlmap', 'nikto', 'nessus', 'acunetix']
  for (const agent of suspiciousAgents) {
    if (userAgent.toLowerCase().includes(agent)) {
      return { valid: false, error: 'Request blocked' }
    }
  }
  
  return { valid: true }
}
