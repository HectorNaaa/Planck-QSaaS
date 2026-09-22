import { describe, it, expect } from 'vitest'
import { getCountryCode, COUNTRY_CODES } from '@/lib/country-codes'

describe('getCountryCode', () => {
  it('returns +1 for United States', () => {
    expect(getCountryCode('United States')).toBe('+1')
  })

  it('returns +91 for India', () => {
    expect(getCountryCode('India')).toBe('+91')
  })

  it('returns +351 for Portugal', () => {
    expect(getCountryCode('Portugal')).toBe('+351')
  })

  it('returns +1 (default) for an unknown country', () => {
    expect(getCountryCode('Unknown Country')).toBe('+1')
  })

  it('returns +1 (default) for an empty string', () => {
    expect(getCountryCode('')).toBe('+1')
  })

  it('returns correct code for all countries in the list', () => {
    for (const country of COUNTRY_CODES) {
      expect(getCountryCode(country.country)).toBe(country.code)
    }
  })
})
