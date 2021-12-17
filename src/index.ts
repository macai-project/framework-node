import { EventBridgeEvent } from "aws-lambda";
import * as Sentry from "@sentry/serverless";
import mysql from "mysql";
import * as C from "io-ts/Codec";
import AWSXRay from "aws-xray-sdk";
import { createPool, Pool } from "./repository";
import { parse } from "./parse";
import logger from "./logger";
import { pipe } from "fp-ts/lib/function";
import { either } from "fp-ts";
import { draw } from "io-ts/lib/Decoder";

const mysqlClient =
  process.env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

export function lambda<O, A>(
  handler: (event: A) => void,
  schema: C.Codec<unknown, O, A>
) {
  return Sentry.AWSLambda.wrapHandler(
    async (event: EventBridgeEvent<string, O>) => {
      pipe(
        parse(schema, event.detail),
        either.fold((err) => logger.error(draw(err)), handler)
      );
    }
  );
}

export function init(): { pool: Pool } {
  Sentry.AWSLambda.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.ENVIRONMENT,
    tracesSampleRate: 1.0,
  });

  const pool = createPool(mysqlClient);

  return { pool };
}

export { default as logger } from "./logger";
export * from "./repository";
export * from "./parse";
