import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './workflows/activities'
import type { AppConfig } from './config'

export async function runTemporalWorker(temporal: AppConfig['temporal']) {
  const connection = await NativeConnection.connect({
    address: temporal.address,
  })
  try {
    const worker = await Worker.create({
      connection,
      namespace: temporal.namespace,
      taskQueue: temporal.taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities,
    })

    await worker.run()
  } finally {
    await connection.close()
  }
}
