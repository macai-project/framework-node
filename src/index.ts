import { EventBridgeEvent, APIGatewayProxyEvent } from "aws-lambda";
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
import { DateFromISOString } from "./codecs/DateFromISOString";
import { decodeOrThrow } from "./codecs/utils";

type SchemaRecord<K extends string> = Record<K, C.Codec<unknown, any, any>>;
type EventLambdaConfig<A, K extends string> = {
  eventDetailSchema: D.Decoder<unknown, A>;
  envSchema?: SchemaRecord<K>;
};
type HttpLambdaConfig<A, K extends string> = {
  body: D.Decoder<unknown, A>;
  headers?: SchemaRecord<K>;
  envSchema?: SchemaRecord<K>;
};

const parTraverse = traverseWithIndex(taskEither.ApplicativePar);

const parseRecordValues = <K extends string>(
  envSchemaRecord: Record<K, D.Decoder<unknown, string>>,
  envRuntime: {
    [key: string]: string | undefined;
  }
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

export type EventMeta = {
  id: string;
  version: string;
  account: string;
  time: Date;
  region: string;
  resources: string[];
  source: string;
  "detail-type": string;
};

export const _eventLambda =
  <O, A, R, K extends string = never>(
    wrapperFunc: WrapHandler<EventBridgeEvent<string, O>, R | void>,
    envRuntime = process.env
  ) =>
  ({ eventDetailSchema, envSchema }: EventLambdaConfig<A, K>) =>
  (
    handler: ({
      event,
      eventMeta,
      env,
    }: {
      event: A;
      eventMeta: EventMeta;
      env: Record<K, string> | undefined;
    }) => taskEither.TaskEither<unknown, R>
  ) => {
    return wrapperFunc((event: EventBridgeEvent<string, O>) => {
      debug("parsing event: ", event.detail);

      const eventMeta = {
        ...event,
        time: decodeOrThrow(DateFromISOString, event.time),
        detail: undefined,
      };

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
        taskEither.bind("eventMeta", () => taskEither.of(eventMeta)),
        taskEither.bind("env", () =>
          envSchema
            ? parseRecordValues(envSchema, envRuntime)
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

export const _httpLambda =
  <A, R, K extends string = never>(
    wrapperFunc: WrapHandler<APIGatewayProxyEvent, R | void>,
    envRuntime = process.env
  ) =>
  (config: HttpLambdaConfig<A, K>) =>
  (
    handler: ({
      body,
      headers,
      env,
    }: {
      body: A;
      headers: Record<K, string> | undefined;
      env: Record<K, string> | undefined;
    }) => taskEither.TaskEither<unknown, R>
  ) => {
    return wrapperFunc((event: APIGatewayProxyEvent) => {
      debug("parsing body: ", config.body);

      const parsedBody = pipe(
        parse(config.body, event.body),
        taskEither.fromEither,
        taskEither.map((v) => {
          debug("parsed body successfully: ", v);
          return v;
        }),
        taskEither.mapLeft((e) => `Incorrect Body Detail: ${draw(e)}`)
      );

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        taskEither.Do,
        taskEither.bind("body", () => parsedBody),
        taskEither.bind("env", () =>
          config.envSchema
            ? parseRecordValues(config.envSchema, envRuntime)
            : taskEither.of(undefined)
        ),
        taskEither.bind("headers", () =>
          config.headers
            ? parseRecordValues(config.headers, event.headers)
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

export const getEventLambda = <O, A, R, K extends string = never>(
  i: EventLambdaConfig<A, K>
) => {
  return _eventLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      event: A;
      env: Record<K, string> | undefined;
      eventMeta: EventMeta;
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<EventBridgeEvent<string, O>, R | void>;
};

export const getHttpLambda = <A, R, K extends string = never>(
  i: HttpLambdaConfig<A, K>
) => {
  return _httpLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      event: A;
      env: Record<K, string> | undefined;
      eventMeta: EventMeta;
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<APIGatewayProxyEvent, R | void>;
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
