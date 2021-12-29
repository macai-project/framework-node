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
import { traverseWithIndex } from "fp-ts/lib/Record";

const mysqlClient =
  process.env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

type SchemaRecord<K extends string> = Record<K, C.Codec<unknown, any, any>>;
type Config<O, A, K extends string> = {
  eventDetailSchema: C.Codec<unknown, O, A>;
  envSchema?: SchemaRecord<K>;
};

const parTraverse = traverseWithIndex(taskEither.ApplicativePar);

const getEnvValues = <K extends string>(
  envSchemaRecord: Record<K, C.Codec<unknown, any, string>>,
  envRuntime: NodeJS.ProcessEnv
): taskEither.TaskEither<string, Record<K, string>> => {
  return pipe(
    envSchemaRecord,
    parTraverse((key, codec) => {
      const codecRecord = C.struct({ [key]: codec });

      return pipe(
        parse(codecRecord, { [key]: envRuntime[key] }),
        taskEither.fromEither,
        taskEither.map((v) => v[key])
      );
    }),
    taskEither.mapLeft((e) => {
      console.log(1111, draw(e));

      return `Incorrect Env runtime: ${draw(e)}`;
    })
  );
};

export const _lambda =
  <O, A, R, K extends string = never>(
    wrapperFunc: WrapHandler<EventBridgeEvent<string, O>, R | void>,
    envRuntime = process.env
  ) =>
  ({ eventDetailSchema, envSchema }: Config<O, A, K>) =>
  (
    handler: ({
      event,
      env,
    }: {
      event: A;
      env: Record<K, string> | undefined;
    }) => taskEither.TaskEither<unknown, R>
  ) => {
    return wrapperFunc(async (event: EventBridgeEvent<string, O>) => {
      // we convert the parsed event to a taskEither so that we can chan the handler
      const parsedEvent = pipe(
        parse(eventDetailSchema, event.detail),
        taskEither.fromEither,
        taskEither.mapLeft((e) => `Incorrect Event Detail: ${draw(e)}`)
      );

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        taskEither.Do,
        taskEither.bind("event", () => parsedEvent),
        taskEither.bind("env", () =>
          envSchema === undefined
            ? taskEither.of(undefined)
            : getEnvValues(envSchema, envRuntime)
        ),
        taskEither.chain(handler)
      );

      // we throw in case of error
      return handlerTask().then((result) => {
        if (either.isLeft(result)) {
          throw new Error(String(result.left));
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
