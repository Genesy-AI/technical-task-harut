import { BulkImportWarning } from '../api/types/leads/bulkImport'

const MAX_NAMED_VALUES = 3

/** One-line summary of the values the backend cleared on import, e.g. "1 invalid value cleared: Country code 'XXX'". */
export const summarizeClearedValues = (warnings: BulkImportWarning[]): string | null => {
  if (warnings.length === 0) return null

  const distinct = [...new Set(warnings.map((warning) => `${warning.label} '${warning.value}'`))]
  const named = distinct.slice(0, MAX_NAMED_VALUES).join(', ')
  const remaining = distinct.length - MAX_NAMED_VALUES
  const more = remaining > 0 ? ` +${remaining} more` : ''
  const noun = warnings.length === 1 ? 'value' : 'values'

  return `${warnings.length} invalid ${noun} cleared: ${named}${more}`
}
