import { getPinoLogger } from '../Logger/Logger'
import { LogStore } from '../Logger/LogStore'

describe.only('LogStore', () => {
  it('when logging and logs are enabled, it prints the log', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const pinoDebugSpy = jest.spyOn(logger, 'debug')

    const logStore = new LogStore(logger, Infinity, () => true)

    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])

    expect(pinoDebugSpy).toHaveBeenCalledWith('foo baz bar', {
      baz: ['bar'],
      foo: 1,
    })
  })

  it('when logging and logs are not enabled, it does not print the log', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const pinoDebugSpy = jest.spyOn(logger, 'debug')

    const logStore = new LogStore(logger, Infinity, () => false)

    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])

    expect(pinoDebugSpy).toHaveBeenCalledTimes(0)
  })

  it('when logging and maximum capacity is reached, it prints a warning', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const pinoWarnSpy = jest.spyOn(logger, 'warn')

    const logStore = new LogStore(logger, 3, () => false)

    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])
    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])
    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])
    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])

    expect(pinoWarnSpy).toHaveBeenCalledWith(
      'MAXIMUM LOG STORE CAPACITY EXEEDED (3 logs)'
    )
  })

  it('when resetting the store and logs are not enabled, it prints the log', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const pinoDebugSpy = jest.spyOn(logger, 'debug')

    const logStore = new LogStore(logger, 3, () => false)

    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])
    logStore.appendLog(['foobazbar'])
    logStore.reset()

    expect(pinoDebugSpy.mock.calls).toEqual([
      [
        'foo baz bar',
        {
          baz: ['bar'],
          foo: 1,
        },
      ],
      ['foobazbar', undefined],
    ])
  })

  it('when resetting the store and logs are enabled, it does not print the log', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const pinoDebugSpy = jest.spyOn(logger, 'debug')

    const logStore = new LogStore(logger, 3, () => true)

    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])
    logStore.appendLog(['foobazbar'])
    logStore.reset()

    expect(pinoDebugSpy).toHaveBeenCalledTimes(2)
  })

  it('when resetting the store, the logs store is cleared', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const logStore = new LogStore(logger, 3, () => true)

    logStore.appendLog(['foo baz bar', { foo: 1, baz: ['bar'] }])
    logStore.appendLog(['foobazbar'])

    expect(logStore.getCapacity()).toBe('2/3')

    logStore.reset()

    expect(logStore.getCapacity()).toBe('0/3')
  })

  it('pass message and merging object to logger.debug when logs are enabled', async () => {
    const logger = getPinoLogger({ name: 'TEST' })
    const pinoDebugSpy = jest.spyOn(logger, 'debug')
    const logStore = new LogStore(logger, Infinity, () => true)

    logStore.appendLog(['LogMessageName', { foo: 'bar' }])

    expect(pinoDebugSpy).toHaveBeenCalledWith('LogMessageName', { foo: 'bar' })
  })
})
