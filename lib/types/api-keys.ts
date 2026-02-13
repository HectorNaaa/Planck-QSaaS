/**
 * API Key Types for Planck Quantum SaaS v0.9
 * 
 * Provides type safety and better debugging capabilities for API keys
 */

/**
 * API Key format version
 */
export type ApiKeyVersion = 'v0.9' | 'legacy'

/**
 * API Key info structure
 */
export interface ApiKeyInfo {
  /** The actual API key string */
  key: string
  /** When the key was created */
  createdAt: Date | string | null
  /** Format version for tracking */
  version: ApiKeyVersion
  /** Whether the key is valid */
  isValid: boolean
  /** Optional validation error message */
  error?: string
}

/**
 * API Key generation response
 */
export interface GenerateApiKeyResponse {
  success: boolean
  apiKey?: string
  error?: string
}

/**
 * API Key retrieval response
 */
export interface GetApiKeyResponse {
  success: boolean
  apiKey?: string | null
  createdAt?: string | null
  error?: string
}

/**
 * API Key revocation response
 */
export interface RevokeApiKeyResponse {
  success: boolean
  error?: string
}

/**
 * Validates API key format
 */
export function validateApiKeyFormat(apiKey: string): ApiKeyInfo {
  if (!apiKey || typeof apiKey !== 'string') {
    return {
      key: '',
      createdAt: null,
      version: 'v0.9',
      isValid: false,
      error: 'API key is required',
    }
  }

  // v0.9 format: 64-character hexadecimal (pure alphanumeric)
  const v09Pattern = /^[a-fA-F0-9]{64}$/
  if (v09Pattern.test(apiKey)) {
    return {
      key: apiKey,
      createdAt: null,
      version: 'v0.9',
      isValid: true,
    }
  }

  // Legacy format: alphanumeric with underscores/hyphens, prefixes like plk_, pk_live_, etc.
  const legacyPattern = /^[a-zA-Z0-9_-]{10,200}$/
  if (legacyPattern.test(apiKey)) {
    return {
      key: apiKey,
      createdAt: null,
      version: 'legacy',
      isValid: true,
      error: 'Warning: Legacy API key format detected. Consider regenerating.',
    }
  }

  return {
    key: apiKey,
    createdAt: null,
    version: 'v0.9',
    isValid: false,
    error: 'Invalid API key format. Expected 64-character hexadecimal string.',
  }
}

/**
 * Gets a user-friendly description of the API key format
 */
export function getApiKeyFormatDescription(version: ApiKeyVersion): string {
  switch (version) {
    case 'v0.9':
      return '64-character alphanumeric (hexadecimal) string'
    case 'legacy':
      return 'Legacy format with prefix (plk_, pk_live_, etc.)'
    default:
      return 'Unknown format'
  }
}

/**
 * Masks an API key for display purposes (shows first 8 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 12) {
    return '••••••••••••'
  }
  
  const first = apiKey.slice(0, 8)
  const last = apiKey.slice(-4)
  const masked = '•'.repeat(apiKey.length - 12)
  
  return `${first}${masked}${last}`
}

/**
 * Debug helper to log API key info safely (without exposing the actual key)
 */
export function debugApiKey(apiKey: string): string {
  const info = validateApiKeyFormat(apiKey)
  return JSON.stringify({
    format: info.version,
    valid: info.isValid,
    length: apiKey.length,
    preview: maskApiKey(apiKey),
    error: info.error,
  }, null, 2)
}
