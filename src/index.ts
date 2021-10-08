import { EventBridgeEvent } from "aws-lambda";
import * as Sentry from "@sentry/serverless";
import mysql from "mysql";
import AWSXRay from "aws-xray-sdk";
import { createRepository, Repository } from "./repository";
import { EventSchema, validate } from "./validator";

const mysqlClient =
  process.env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

export function lambda<Event extends EventBridgeEvent<string, any>, Schema>(
  handler: (event: Event, repository: Repository) => Promise<unknown>,
  schema: EventSchema<Schema>
) {
  return Sentry.AWSLambda.wrapHandler(async (event: Event) => {
    // Validate event payload
    if (validate(schema, event.detail)) {
      return await handler(event, createRepository(mysqlClient));
    } else {
      return new Error("KO: Payload not valid");
    }
  });
}

export function init() {
  Sentry.AWSLambda.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

export { default as logger } from "./logger";
export * from "./repository";
export * from "./validator";
