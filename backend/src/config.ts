// Runtime settings that differ between parallel local instances (see "Isolated environments" in CLAUDE.md).
// A Temporal namespace per instance isolates both task queues and workflow IDs, so the queue can stay fixed.
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    port: parsePort(env.PORT),
    temporal: {
      address: 'localhost:7233',
      namespace: env.TEMPORAL_NAMESPACE?.trim() || 'default',
      taskQueue: 'myQueue',
    },
  }
}

export type AppConfig = ReturnType<typeof loadConfig>

// Fail fast: Express would treat a non-numeric value as a named pipe path and start without an error.
function parsePort(value: string | undefined): number {
  if (!value?.trim()) return 4000

  const port = Number(value)
  if (!/^\d+$/.test(value.trim()) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT "${value}": expected an integer between 1 and 65535`)
  }
  return port
}
