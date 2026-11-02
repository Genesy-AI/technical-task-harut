import { describe, it, expect } from 'vitest'
import { loadConfig } from './config'

describe('loadConfig', () => {
  it('defaults to the single-instance setup', () => {
    expect(loadConfig({})).toEqual({
      port: 4000,
      temporal: { address: 'localhost:7233', namespace: 'default', taskQueue: 'myQueue' },
    })
  })

  it('reads PORT and TEMPORAL_NAMESPACE from the environment', () => {
    const config = loadConfig({ PORT: '4001', TEMPORAL_NAMESPACE: ' wt-1 ' })

    expect(config.port).toBe(4001)
    expect(config.temporal.namespace).toBe('wt-1')
  })

  it('treats empty values as unset', () => {
    expect(loadConfig({ PORT: '', TEMPORAL_NAMESPACE: ' ' })).toEqual(loadConfig({}))
  })

  it.each(['abc', '0', '65536', '40.5', '0x1F90', '1e3', '0b1', '-1'])(
    'rejects invalid PORT "%s"',
    (port) => {
      expect(() => loadConfig({ PORT: port })).toThrow(`Invalid PORT "${port}"`)
    }
  )
})
