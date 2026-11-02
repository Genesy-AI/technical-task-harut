import { describe, it, expect } from 'vitest'
import { summarizeClearedValues } from './importSummary'

const warning = (value: string, label = 'Country code') => ({ lead: 'Jane Doe', field: 'x', label, value })

describe('summarizeClearedValues', () => {
  it('returns null when nothing was cleared', () => {
    expect(summarizeClearedValues([])).toBeNull()
  })

  it('uses the singular for one cleared value', () => {
    expect(summarizeClearedValues([warning('XXX')])).toBe("1 invalid value cleared: Country code 'XXX'")
  })

  it('names each distinct value once but counts every cleared value', () => {
    expect(summarizeClearedValues([warning('12'), warning('XXX'), warning('XXX')])).toBe(
      "3 invalid values cleared: Country code '12', Country code 'XXX'"
    )
  })

  it('names the first three distinct values and counts the rest', () => {
    const warnings = ['XXX', '12', 'UK', 'EU', 'ZZ'].map((value) => warning(value))

    expect(summarizeClearedValues(warnings)).toBe(
      "5 invalid values cleared: Country code 'XXX', Country code '12', Country code 'UK' +2 more"
    )
  })

  it('labels each value with its own field', () => {
    expect(summarizeClearedValues([warning('XXX'), warning('abc', 'Phone number')])).toBe(
      "2 invalid values cleared: Country code 'XXX', Phone number 'abc'"
    )
  })
})
