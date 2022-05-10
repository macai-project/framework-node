import pino from "pino";

export type Log = [message: string, mergingObject?: Record<string, unknown>];

interface LoggerOptions {
  name: string;
}

export interface Logger {
  debug(...args: Log): void;
  warn(msg: string): void;
  info(msg: string): void;
}

export const getPinoLogger = ({ name }: LoggerOptions): Logger => {
  const logger = pino({ name, level: "debug" });

  return {
    debug: (...args: Log) => {
      logger.debug(args[1], args[0]);
    },
    warn: (msg: string) => logger.warn(msg),
    info: (msg: string) => logger.info(msg),
  }
};
