import * as Sentry from "@sentry/serverless";

const log = (message: any) =>
  typeof message === "object" ? JSON.stringify(message) : message;

const isTest = () => process.env.NODE_ENV === "test";
const logEnabled = () => process.env.FRAMEWORK_LOGS === "true";

const logger = {
  info: (...args: any[]) => logEnabled() && console.info(...args.map(log)),
  log: (...args: any[]) => logEnabled() && console.log(...args.map(log)),
  error: (error: Error | string, ...args: any[]) => {
    if (isTest()) {
      console.error(error, ...args.map(log));
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
