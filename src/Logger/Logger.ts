import * as logger from 'lambda-log'

export type Log = [message: string, mergingObject?: Record<string, unknown>]

export interface LoggerOptions {
  level: LogLevel
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'silent'

export interface Logger {
  debug(...args: Log): void
  warn(...args: Log): void
  error(...args: Log): void
  info(...args: Log): void
}

export const getLogger = (): Logger => {
  return {
    debug: (...args: Log) => {
      logger.debug(args[0], args[1])
    },
    warn: (...args: Log) => logger.warn(args[0], args[1]),
    error: (...args: Log) => logger.error(args[0], args[1]),
    info: (...args: Log) => logger.info(args[0], args[1]),
  }
}
