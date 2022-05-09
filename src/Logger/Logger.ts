import pino from "pino";

export type Log = [s: string, ...args: any[]];

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

  return logger;
};
