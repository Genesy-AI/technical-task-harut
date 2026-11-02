import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import path from 'path'
import { WorkflowFailedError } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { verifyEmailWorkflow } from './workflows'

const TASK_QUEUE = 'verify-email-test'

describe('verifyEmailWorkflow', () => {
  let env: TestWorkflowEnvironment

  // The first run downloads the Temporal test server.
  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping()
  }, 120_000)

  afterAll(async () => {
    await env?.teardown()
  })

  async function runWorkflow(verifyEmail: (email: string) => Promise<boolean>) {
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue: TASK_QUEUE,
      workflowsPath: path.resolve(__dirname, 'workflows.ts'),
      activities: { verifyEmail },
    })
    return worker.runUntil(
      env.client.workflow.execute(verifyEmailWorkflow, {
        taskQueue: TASK_QUEUE,
        workflowId: `verify-email-test-${crypto.randomUUID()}`,
        args: ['lead@example.com'],
      })
    )
  }

  it('returns the activity result', async () => {
    const verifyEmail = vi.fn(async () => true)

    await expect(runWorkflow(verifyEmail)).resolves.toBe(true)
    expect(verifyEmail).toHaveBeenCalledWith('lead@example.com')
  }, 60_000)

  it('fails with a start-to-close timeout after a bounded number of attempts', async () => {
    // Longer than the 1s start-to-close timeout, but finite so the worker can shut down cleanly.
    const verifyEmail = vi.fn(() => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 2_000)))

    const error = await runWorkflow(verifyEmail).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(WorkflowFailedError)
    expect(error).toMatchObject({
      cause: { retryState: 'MAXIMUM_ATTEMPTS_REACHED', cause: { timeoutType: 'START_TO_CLOSE' } },
    })
    expect(verifyEmail).toHaveBeenCalledTimes(3)
  }, 60_000)
})
