import { describe, it, expect } from 'vitest'
import { normalizeCountryCode } from './countryCode'

describe('normalizeCountryCode', () => {
  it('uppercases a valid ISO 3166-1 alpha-2 code', () => {
    expect(normalizeCountryCode('us')).toBe('US')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeCountryCode(' gb ')).toBe('GB')
  })

  it.each(['UK', 'EU', 'XXX', '12', ''])('rejects %j', (raw) => {
    expect(normalizeCountryCode(raw)).toBeNull()
  })

  it.each([undefined, null, 12])('rejects non-string %j', (raw) => {
    expect(normalizeCountryCode(raw)).toBeNull()
  })
})
