import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 second',
  // Temporal's default retry policy retries forever, so an always-slow provider would never let the workflow finish.
  retry: { maximumAttempts: 3, initialInterval: '1s', backoffCoefficient: 2 },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
