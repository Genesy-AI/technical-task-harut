export interface LeadsBulkImportInput {
  leads: {
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    countryCode?: string
    companyName?: string
    phoneNumber?: string
    yearsAtCompany?: string
    linkedinUrl?: string
  }[]
}

export interface LeadsBulkImportOutput {
  success: boolean
  importedCount: number
  duplicatesSkipped: number
  invalidLeads: number
  errors: Array<{
    lead: any
    error: string
  }>
  /** Optional values that failed backend validation and were stored as empty. */
  warnings: BulkImportWarning[]
}

export interface BulkImportWarning {
  lead: string
  field: string
  label: string
  value: string
}
