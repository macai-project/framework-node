import { EventBridgeEvent } from "aws-lambda";
import * as Sentry from "@sentry/serverless";
import mysql from "mysql";
import * as C from "io-ts/Codec";
import AWSXRay from "aws-xray-sdk";
import { createPool, Pool } from "./repository";
import { parse } from "./parse";
import { pipe } from "fp-ts/lib/function";
import { either, taskEither } from "fp-ts";
import { draw } from "io-ts/lib/Decoder";
import { WrapHandler } from "./handler";

const mysqlClient =
  process.env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

export const _lambda =
  <O, A, R>(wrapperFunc: WrapHandler<EventBridgeEvent<string, O>, R | void>) =>
  (
    handler: (event: A) => taskEither.TaskEither<unknown, R>,
    schema: C.Codec<unknown, O, A>
  ) => {
    return wrapperFunc(async (event: EventBridgeEvent<string, O>) => {
      // we convert the parsed event to a taskEither so that we can chan the handler
      const parsedEvent = taskEither.fromEither(parse(schema, event.detail));

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        parsedEvent,
        taskEither.mapLeft(draw),
        taskEither.chain(handler)
      );

      // we throw in case of error
      return handlerTask().then((result) => {
        if (either.isLeft(result)) {
          throw new Error(`Lambda failed with error: ${result.left}`);
        }

        return result.right;
      });
    });
  };

export const lambda = _lambda(Sentry.AWSLambda.wrapHandler);

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
