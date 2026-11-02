import { queryOptions } from '@tanstack/react-query'
import { api } from '..'

// The field list only changes with a deploy, so it is fetched once per session.
export const leadFieldsQueryOptions = queryOptions({
  queryKey: ['leads', 'fields'],
  queryFn: async () => api.leads.fields(),
  staleTime: Infinity,
  // The picker shows a Retry button, so fail fast instead of hiding the error behind backoff.
  retry: false,
})
