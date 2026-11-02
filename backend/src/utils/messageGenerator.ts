import type { lead as PrismaLead } from '@prisma/client'
import { isLeadFieldKey, LeadFieldKey } from './leadFields'

export type Lead = { firstName: string } & { [K in LeadFieldKey]?: PrismaLead[K] | null }

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  let message = template

  const templateVariables = template.match(/\{(\w+)\}/g) || []

  for (const variable of templateVariables) {
    const fieldName = variable.slice(1, -1)

    if (isLeadFieldKey(fieldName)) {
      const fieldValue = lead[fieldName]

      if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
        throw new Error(`Missing required field: ${fieldName}`)
      }

      // A replacer function inserts the value literally; a string would expand `$&`, `$1` etc. in lead data.
      message = message.replace(new RegExp(`\\{${fieldName}\\}`, 'g'), () => String(fieldValue))
    } else {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }
  }

  return message
}
