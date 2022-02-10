import * as Sentry from "@sentry/serverless";

const log = (message: any) =>
  typeof message === "object" ? JSON.stringify(message) : message;

const logger = {
  info: (...args: any[]) => console.info(...args.map(log)),
  log: (...args: any[]) => console.log(...args.map(log)),
  error: (error: Error | string, ...args: any[]) => {
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(error);
    }
    console.error(error, ...args.map(log));
  },
};

export const debug = (s: string, ...args: any[]) => {
  logger.info(`[node-framework] ${s}`, ...args);
};

export default logger;
