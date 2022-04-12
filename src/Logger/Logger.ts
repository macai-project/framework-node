import pino from "pino";

export type Log = [s: string, ...args: any[]];

interface LoggerOptions {
  name: string;
}

export interface Logger {
  debug(...args: Log): void;
  warn(msg: string): void;
}

export const getPinoLogger = ({ name }: LoggerOptions): Logger => {
  return pino({ name });
};
