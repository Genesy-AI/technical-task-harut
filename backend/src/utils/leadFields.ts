import type { lead } from '@prisma/client'
import { normalizeCountryCode } from './countryCode'

export type LeadFieldValue = string | number

export interface LeadField {
  key: keyof lead
  label: string
  /** Returns the value to store, or null when the input is empty or invalid. Defaults to trimming text. */
  normalize?: (raw: unknown) => LeadFieldValue | null
}

const PHONE_PATTERN = /^[\d+(). -]+(?:x\d+)?$/i
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 15
const MAX_YEARS_AT_COMPANY = 80

export const normalizeText = (raw: unknown): string | null =>
  typeof raw === 'string' && raw.trim() ? raw.trim() : null

// Stored as entered: the sample data mixes national formats and extensions, so E.164 would corrupt it.
export const normalizePhoneNumber = (raw: unknown): string | null => {
  const phone = normalizeText(raw)
  if (!phone || !PHONE_PATTERN.test(phone)) return null

  const digitCount = phone.replace(/x\d+$/i, '').replace(/\D/g, '').length
  return digitCount >= MIN_PHONE_DIGITS && digitCount <= MAX_PHONE_DIGITS ? phone : null
}

export const normalizeYearsAtCompany = (raw: unknown): number | null => {
  const text = typeof raw === 'number' ? String(raw) : normalizeText(raw)
  if (!text || !/^\d+$/.test(text)) return null

  const years = Number(text)
  return years <= MAX_YEARS_AT_COMPANY ? years : null
}

export const normalizeLinkedinUrl = (raw: unknown): string | null => {
  const text = normalizeText(raw)
  if (!text) return null

  let url: URL
  try {
    // Anything without an http(s) scheme gets one; other schemes (javascript:, ftp:) then fail the host check.
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }

  const isLinkedinHost = url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')
  // Only personal profiles (/in/<name>): the bare domain, feeds and company pages aren't a lead's profile.
  const isProfilePath = /^\/in\/[^/]+\/?$/.test(url.pathname)
  if (!isLinkedinHost || !isProfilePath || url.port || url.username || url.password) return null

  url.protocol = 'https:'
  return url.toString()
}

/** The lead fields usable in message templates and settable via bulk import. */
export const LEAD_FIELDS = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'companyName', label: 'Company name' },
  { key: 'countryCode', label: 'Country code', normalize: normalizeCountryCode },
  { key: 'phoneNumber', label: 'Phone number', normalize: normalizePhoneNumber },
  { key: 'yearsAtCompany', label: 'Years at company', normalize: normalizeYearsAtCompany },
  { key: 'linkedinUrl', label: 'LinkedIn URL', normalize: normalizeLinkedinUrl },
] as const satisfies readonly LeadField[]

export type LeadFieldKey = (typeof LEAD_FIELDS)[number]['key']

const LEAD_FIELD_KEYS: ReadonlySet<string> = new Set(LEAD_FIELDS.map((field) => field.key))

export const isLeadFieldKey = (key: string): key is LeadFieldKey => LEAD_FIELD_KEYS.has(key)

const MAX_REPORTED_VALUE_LENGTH = 50

/** The stored value per field: each field's normalizer output, or trimmed text by default. */
export type NormalizedLeadFields = {
  [F in (typeof LEAD_FIELDS)[number] as F['key']]: F extends { normalize: (raw: unknown) => infer R }
    ? R
    : string | null
}

export interface InvalidLeadField {
  field: LeadFieldKey
  label: string
  value: string
}

/**
 * Normalizes every lead field of an untrusted input. A non-empty value that fails normalization is stored as
 * null and reported in `invalid`, so one bad optional value never drops the whole lead.
 */
export const normalizeLeadFields = (input: Record<string, unknown>) => {
  const values: Partial<Record<LeadFieldKey, LeadFieldValue | null>> = {}
  const invalid: InvalidLeadField[] = []

  for (const field of LEAD_FIELDS) {
    const raw = input[field.key]
    const normalize: (raw: unknown) => LeadFieldValue | null =
      'normalize' in field ? field.normalize : normalizeText
    const value = normalize(raw)

    values[field.key] = value
    // Only scalar input is echoed back (objects would read "[object Object]"), bounded so it can't bloat the toast.
    const scalar = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
    const reported = scalar.slice(0, MAX_REPORTED_VALUE_LENGTH)
    if (value === null && reported) {
      invalid.push({ field: field.key, label: field.label, value: reported })
    }
  }

  // Every key is assigned by its own field's normalizer above; TypeScript can't relate the two inside the loop.
  return { values: values as NormalizedLeadFields, invalid }
}
