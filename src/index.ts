import { EventBridgeEvent } from "aws-lambda";
import * as Sentry from "@sentry/serverless";
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import { DynamoDB } from "aws-sdk";
import {
  createDynamoClient,
  createAuroraPool,
  createEventBridgeClient,
  MySQLPool,
  createAppSyncClient,
  AWSAppSyncClient,
} from "./repository";
import { parse } from "./parse";
import { pipe } from "fp-ts/lib/function";
import { string, either, taskEither } from "fp-ts";
import { draw } from "io-ts/lib/Decoder";
import { WrapHandler } from "./handler";
import { traverseWithIndex } from "fp-ts/lib/Record";
import { debug } from "./logger";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { logger } from ".";

type SchemaRecord<K extends string> = Record<K, C.Codec<unknown, any, any>>;
type Config<O, A, K extends string> = {
  eventDetailSchema: D.Decoder<unknown, A>;
  envSchema?: SchemaRecord<K>;
};

const parTraverse = traverseWithIndex(taskEither.ApplicativePar);

const getEnvValues = <K extends string>(
  envSchemaRecord: Record<K, D.Decoder<unknown, string>>,
  envRuntime: NodeJS.ProcessEnv
): taskEither.TaskEither<string, Record<K, string>> => {
  return pipe(
    envSchemaRecord,
    parTraverse((key, codec) => {
      const decoderRecord = D.struct({ [key]: codec });
      debug("parsing env: ", envSchemaRecord);

      return pipe(
        parse(decoderRecord, { [key]: envRuntime[key] }),
        taskEither.fromEither,
        taskEither.map((v) => {
          debug("parsed env successfully!");
          return v[key];
        })
      );
    }),
    taskEither.mapLeft((e) => {
      return `incorrect Env runtime: ${draw(e)}`;
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
    return wrapperFunc((event: EventBridgeEvent<string, O>) => {
      debug("parsing event: ", event.detail);

      const parsedEvent = pipe(
        parse(eventDetailSchema, event.detail),
        taskEither.fromEither,
        taskEither.map((v) => {
          debug("parsed event successfully: ", v);
          return v;
        }),
        taskEither.mapLeft((e) => `Incorrect Event Detail: ${draw(e)}`)
      );

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        taskEither.Do,
        taskEither.bind("event", () => parsedEvent),
        taskEither.bind("env", () =>
          envSchema
            ? getEnvValues(envSchema, envRuntime)
            : taskEither.of(undefined)
        ),
        taskEither.chain(handler)
      );

      // we throw in case of error
      return handlerTask()
        .then((result) => {
          if (either.isLeft(result)) {
            if (string.isString(result.left)) {
              throw `[node-framework] ${result.left}`;
            } else {
              debug("unknown error...: ", result.left);
              throw new Error("[node-framework] handler unknown error");
            }
          }

          debug("handler succeded with payload: ", result.right);

          return result.right;
        })
        .catch((e) => {
          debug("handler failed!: ", e);
          throw e;
        });
    });
  };

export const getLambda = <O, A, R, K extends string = never>(
  i: Config<O, A, K>
) => {
  return _lambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      event: A;
      env: Record<K, string> | undefined;
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<EventBridgeEvent<string, O>, R | void>;
};

type InitResult<
  A extends boolean,
  D extends boolean,
  AS extends boolean,
  EB extends boolean
> = (A extends false ? {} : { auroraPool: MySQLPool }) &
  (D extends false ? {} : { dynamo: DynamoDB }) &
  (AS extends false ? {} : { appSync: AWSAppSyncClient }) &
  (EB extends false ? {} : { eventBridge: EventBridgeClient });

export function init<
  A extends boolean = false,
  D extends boolean = false,
  AS extends boolean = false,
  EB extends boolean = false
>({
  aurora,
  dynamo,
  appSync,
  eventBridge,
  env = process.env,
}: {
  aurora?: A;
  dynamo?: D;
  appSync?: AS;
  eventBridge?: EB;
  env?: Record<string, string | undefined>;
}): InitResult<A, D, AS, EB> {
  Sentry.AWSLambda.init({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: 1.0,
  });

  const auroraPool = aurora && createAuroraPool(env);
  const dynamoClient = dynamo && createDynamoClient(env);
  const appSyncClient = appSync && createAppSyncClient(env);
  const eventBridgeClient = eventBridge && createEventBridgeClient(env);

  return {
    auroraPool,
    dynamo: dynamoClient,
    appSync: appSyncClient,
    eventBridge: eventBridgeClient,
  } as InitResult<A, D, AS, EB>;
}

export { default as logger } from "./logger";
export * from "./repository";
export * from "./parse";
