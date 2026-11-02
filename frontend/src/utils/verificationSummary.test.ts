import { describe, it, expect } from 'vitest'
import { summarizeVerification } from './verificationSummary'

const result = (emailVerified: boolean) => ({ leadId: 1, emailVerified })
const failure = (leadName: string) => ({ leadId: 2, leadName, error: 'Workflow execution failed' })

describe('summarizeVerification', () => {
  it('reports valid and invalid counts as a success when nothing failed', () => {
    expect(
      summarizeVerification({ results: [result(true), result(true), result(false)], errors: [] })
    ).toEqual({
      kind: 'success',
      message: '2 valid, 1 invalid',
    })
  })

  it('omits a zero count', () => {
    expect(summarizeVerification({ results: [result(true)], errors: [] }).message).toBe('1 valid')
  })

  it('names the leads that could not be verified as a warning when some were checked', () => {
    expect(
      summarizeVerification({ results: [result(true), result(false)], errors: [failure('Jane Smith')] })
    ).toEqual({
      kind: 'warning',
      message: "1 valid, 1 invalid, couldn't verify Jane Smith. Please try again later.",
    })
  })

  it('is an error when nothing could be verified', () => {
    expect(summarizeVerification({ results: [], errors: [failure('Jane Smith')] })).toEqual({
      kind: 'error',
      message: "Couldn't verify Jane Smith. Please try again later.",
    })
  })

  it('names the first three failed leads and counts the rest', () => {
    const errors = ['Ann', 'Bob', 'Cid', 'Dee', 'Eve'].map(failure)

    expect(summarizeVerification({ results: [], errors }).message).toBe(
      "Couldn't verify Ann, Bob, Cid +2 more. Please try again later."
    )
  })
})
