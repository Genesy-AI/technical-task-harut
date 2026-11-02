import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'

const MAX_NAMED_LEADS = 3

export interface VerificationSummary {
  kind: 'success' | 'warning' | 'error'
  message: string
}

/**
 * Toast text for a verification run. "Invalid" (checked, bad address) and "couldn't verify" (no result, worth
 * retrying) are reported separately so users don't mistake one for the other.
 */
export const summarizeVerification = ({
  results,
  errors,
}: Pick<LeadsVerifyEmailsOutput, 'results' | 'errors'>): VerificationSummary => {
  const validCount = results.filter((result) => result.emailVerified).length
  const invalidCount = results.length - validCount
  const checked: string[] = []
  if (validCount > 0) checked.push(`${validCount} valid`)
  if (invalidCount > 0) checked.push(`${invalidCount} invalid`)

  if (errors.length === 0) return { kind: 'success', message: checked.join(', ') }

  const names = errors.slice(0, MAX_NAMED_LEADS).map((error) => error.leadName)
  const more = errors.length > MAX_NAMED_LEADS ? ` +${errors.length - MAX_NAMED_LEADS} more` : ''
  const summary = [...checked, `couldn't verify ${names.join(', ')}${more}`].join(', ')
  const message = `${summary[0].toUpperCase()}${summary.slice(1)}. Please try again later.`

  return { kind: checked.length === 0 ? 'error' : 'warning', message }
}
