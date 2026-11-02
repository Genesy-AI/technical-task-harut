import { describe, it, expect } from 'vitest'
import {
  isLeadFieldKey,
  LEAD_FIELDS,
  normalizeLeadFields,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  normalizeYearsAtCompany,
} from './leadFields'

describe('normalizePhoneNumber', () => {
  it.each([
    '+1-280-754-0462x2154',
    '(731)123-9702',
    '063.430.8860x4762',
    '001-464-312-8555',
    '+44 20 7946 0958',
  ])('keeps %s as entered', (phone) => {
    expect(normalizePhoneNumber(phone)).toBe(phone)
  })

  it('trims surrounding whitespace', () => {
    expect(normalizePhoneNumber('  (731)123-9702 ')).toBe('(731)123-9702')
  })

  it('rejects numbers with too few or too many digits', () => {
    expect(normalizePhoneNumber('123-456')).toBeNull()
    expect(normalizePhoneNumber('1234567890123456')).toBeNull()
  })

  it('does not count the extension towards the digit limit', () => {
    expect(normalizePhoneNumber('123-456x7890')).toBeNull()
  })

  it('rejects letters and other characters', () => {
    expect(normalizePhoneNumber('call me maybe')).toBeNull()
    expect(normalizePhoneNumber('555-CALL-NOW')).toBeNull()
    expect(normalizePhoneNumber('555#123#4567')).toBeNull()
    expect(normalizePhoneNumber('555\n123\t4567')).toBeNull()
  })

  it('returns null for empty or non-string input', () => {
    expect(normalizePhoneNumber('')).toBeNull()
    expect(normalizePhoneNumber('   ')).toBeNull()
    expect(normalizePhoneNumber(undefined)).toBeNull()
    expect(normalizePhoneNumber(5551234567)).toBeNull()
  })
})

describe('normalizeYearsAtCompany', () => {
  it('keeps 0', () => {
    expect(normalizeYearsAtCompany(0)).toBe(0)
    expect(normalizeYearsAtCompany('0')).toBe(0)
  })

  it('accepts integers as numbers or numeric strings', () => {
    expect(normalizeYearsAtCompany(12)).toBe(12)
    expect(normalizeYearsAtCompany('2')).toBe(2)
    expect(normalizeYearsAtCompany(' 80 ')).toBe(80)
  })

  it('rejects decimals, negatives, out-of-range and non-numeric values', () => {
    expect(normalizeYearsAtCompany('2.5')).toBeNull()
    expect(normalizeYearsAtCompany(2.5)).toBeNull()
    expect(normalizeYearsAtCompany('-1')).toBeNull()
    expect(normalizeYearsAtCompany(-1)).toBeNull()
    expect(normalizeYearsAtCompany('81')).toBeNull()
    expect(normalizeYearsAtCompany('two')).toBeNull()
    expect(normalizeYearsAtCompany(Number.NaN)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(normalizeYearsAtCompany('')).toBeNull()
    expect(normalizeYearsAtCompany(undefined)).toBeNull()
    expect(normalizeYearsAtCompany(null)).toBeNull()
  })
})

describe('normalizeLinkedinUrl', () => {
  it('adds https to a URL without a scheme', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/jane-doe')).toBe('https://linkedin.com/in/jane-doe')
    expect(normalizeLinkedinUrl('www.linkedin.com/in/jane-doe')).toBe('https://www.linkedin.com/in/jane-doe')
  })

  it('upgrades http to https and accepts LinkedIn subdomains', () => {
    expect(normalizeLinkedinUrl('http://uk.linkedin.com/in/jane')).toBe('https://uk.linkedin.com/in/jane')
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/jane')).toBe('https://www.linkedin.com/in/jane')
  })

  it('rejects other hosts, including look-alikes', () => {
    expect(normalizeLinkedinUrl('https://example.com/in/jane')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com.evil.com/in/jane')).toBeNull()
    expect(normalizeLinkedinUrl('https://notlinkedin.com/in/jane')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com@evil.com/in/jane')).toBeNull()
    expect(normalizeLinkedinUrl('https://user@linkedin.com/in/jane')).toBeNull()
  })

  it('accepts only personal profile pages', () => {
    expect(normalizeLinkedinUrl('linkedin.com')).toBeNull()
    expect(normalizeLinkedinUrl('https://www.linkedin.com/feed')).toBeNull()
    expect(normalizeLinkedinUrl('https://www.linkedin.com/company/acme')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com:8443/in/jane')).toBeNull()
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/jane/')).toBe(
      'https://www.linkedin.com/in/jane/'
    )
  })

  it('rejects non-http schemes', () => {
    expect(normalizeLinkedinUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeLinkedinUrl('javascript://linkedin.com/%0aalert(1)')).toBeNull()
    expect(normalizeLinkedinUrl('ftp://linkedin.com/in/jane')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(normalizeLinkedinUrl('')).toBeNull()
    expect(normalizeLinkedinUrl(undefined)).toBeNull()
  })
})

describe('LEAD_FIELDS', () => {
  it('has unique keys usable as {tokens} in templates', () => {
    const keys = LEAD_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
    keys.forEach((key) => expect(key).toMatch(/^\w+$/))
  })

  it('recognises only known keys', () => {
    expect(isLeadFieldKey('phoneNumber')).toBe(true)
    expect(isLeadFieldKey('message')).toBe(false)
  })
})

describe('normalizeLeadFields', () => {
  it('trims text fields and normalizes the new fields', () => {
    const { values, invalid } = normalizeLeadFields({
      firstName: ' Jane ',
      lastName: 'Doe',
      email: 'jane@example.com',
      jobTitle: '  ',
      phoneNumber: '(731)123-9702',
      yearsAtCompany: '0',
      linkedinUrl: 'linkedin.com/in/jane',
    })

    expect(values).toMatchObject({
      firstName: 'Jane',
      jobTitle: null,
      companyName: null,
      phoneNumber: '(731)123-9702',
      yearsAtCompany: 0,
      linkedinUrl: 'https://linkedin.com/in/jane',
    })
    expect(invalid).toEqual([])
  })

  it('clears invalid values and reports them', () => {
    const { values, invalid } = normalizeLeadFields({
      firstName: 'Jane',
      phoneNumber: 'abc',
      yearsAtCompany: 2.5,
      linkedinUrl: 'foo.com',
    })

    expect(values).toMatchObject({ phoneNumber: null, yearsAtCompany: null, linkedinUrl: null })
    expect(invalid).toEqual([
      { field: 'phoneNumber', label: 'Phone number', value: 'abc' },
      { field: 'yearsAtCompany', label: 'Years at company', value: '2.5' },
      { field: 'linkedinUrl', label: 'LinkedIn URL', value: 'foo.com' },
    ])
  })

  it('clears non-scalar values without echoing them, and bounds long values', () => {
    const { values, invalid } = normalizeLeadFields({
      linkedinUrl: { evil: true },
      phoneNumber: 'x'.repeat(500),
    })

    expect(values).toMatchObject({ linkedinUrl: null, phoneNumber: null })
    expect(invalid).toEqual([{ field: 'phoneNumber', label: 'Phone number', value: 'x'.repeat(50) }])
  })

  it('normalizes country codes and reports invalid ones', () => {
    expect(normalizeLeadFields({ countryCode: ' us ' }).values.countryCode).toBe('US')

    const { values, invalid } = normalizeLeadFields({ countryCode: 'XXX' })
    expect(values.countryCode).toBeNull()
    expect(invalid).toEqual([{ field: 'countryCode', label: 'Country code', value: 'XXX' }])
  })

  it('ignores fields that are not lead fields', () => {
    const { values } = normalizeLeadFields({ firstName: 'Jane', message: 'injected', id: 7 })
    expect(values).not.toHaveProperty('message')
    expect(values).not.toHaveProperty('id')
  })
})
