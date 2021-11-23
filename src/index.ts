import { EventBridgeEvent } from "aws-lambda";
import * as Sentry from "@sentry/serverless";
import mysql from "mysql";
import AWSXRay from "aws-xray-sdk";
import { createPool, Pool } from "./repository";
import { EventSchema, validate } from "./validator";

const mysqlClient =
  process.env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

export function lambda<Event extends EventBridgeEvent<string, any>, Schema>(
  handler: (event: Event) => Promise<unknown>,
  schema: EventSchema<Schema>
) {
  return Sentry.AWSLambda.wrapHandler(async (event: Event) => {
    // Validate event payload
    if (validate(schema, event.detail)) {
      try {
        return await handler(event);
      } catch (error: any) {
        if (error instanceof Error) {
          throw error;
        } else {
          throw Error(error);
        }
      }
    } else {
      throw Error("Payload not valid");
    }
  });
}

export function init(): { pool: Pool } {
  Sentry.AWSLambda.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.ENVIRONMENT,
    tracesSampleRate: 1.0,
  });
  const pool = createPool(mysqlClient);

  return {
    pool,
  };
}

export { default as logger } from "./logger";
export * from "./repository";
export * from "./validator";
