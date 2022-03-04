import * as Sentry from "@sentry/serverless";

const log = (message: any) =>
  typeof message === "object" ? JSON.stringify(message) : message;

const isTest = () => process.env.NODE_ENV === "test";

const logger = {
  info: (...args: any[]) => !isTest() && console.info(...args.map(log)),
  log: (...args: any[]) => !isTest() && console.log(...args.map(log)),
  error: (error: Error | string, ...args: any[]) => {
    if (isTest()) {
      return;
    }
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
