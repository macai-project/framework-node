import {
  EventBridgeEvent,
  APIGatewayProxyEvent,
  AppSyncResolverEvent,
} from "aws-lambda";
import * as Sentry from "@sentry/serverless";
import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import { parse } from "./parse";
import { pipe } from "fp-ts/lib/function";
import { string, either, taskEither } from "fp-ts";
import { draw } from "io-ts/lib/Decoder";
import { WrapHandler } from "./handler";
import { traverseWithIndex } from "fp-ts/lib/Record";
import { DateFromISOString } from "./codecs/DateFromISOString";
import { decodeOrThrow } from "./codecs/utils";
import { LogStore } from "./Logger/LogStore";
import { getPinoLogger } from "./Logger/Logger";

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

type AppSyncLambdaConfig<A, K extends string> = {
  args: D.Decoder<unknown, A>;
  envSchema?: SchemaRecord<K>;
};

const parTraverse = traverseWithIndex(taskEither.ApplicativePar);

const parseRecordValues = <K extends string>(
  envSchemaRecord: Record<K, D.Decoder<unknown, string>>,
  envRuntime: {
    [key: string]: string | undefined;
  },
  logStore: LogStore
): taskEither.TaskEither<string, Record<K, string>> => {
  return pipe(
    envSchemaRecord,
    parTraverse((key, codec) => {
      const decoderRecord = D.struct({ [key]: codec });
      logStore.appendLog(["parsing env: ", envSchemaRecord]);

      return pipe(
        parse(decoderRecord, { [key]: envRuntime[key] }),
        taskEither.fromEither,
        taskEither.map((v) => {
          logStore.appendLog(["parsed env successfully!"]);
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
          logStore: LogStore;
        }) => taskEither.TaskEither<unknown, R>
      ) => {
        return wrapperFunc((event: EventBridgeEvent<string, O>) => {
          const logStore = new LogStore(
            getPinoLogger({ name: "framework-node" }),
            500
          );

          logStore.appendLog(["parsing event: ", event.detail]);

          const eventMeta = {
            ...event,
            time: decodeOrThrow(DateFromISOString, event.time),
            detail: undefined,
          };

          const parsedEvent = pipe(
            parse(eventDetailSchema, event.detail),
            taskEither.fromEither,
            taskEither.map((v) => {
              logStore.appendLog(["parsed event successfully: ", v]);
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
                ? parseRecordValues(envSchema, envRuntime, logStore)
                : taskEither.of(undefined)
            ),
            taskEither.chain((i) => handler({ ...i, logStore }))
          );

          // we throw in case of error
          return handlerTask()
            .then((result) => {
              if (either.isLeft(result)) {
                if (string.isString(result.left)) {
                  throw `[node-framework] ${result.left}`;
                } else {
                  logStore.appendLog(["unknown error...: ", result.left]);
                  throw new Error("[node-framework] handler unknown error");
                }
              }

              logStore.appendLog(["handler succeded with payload: ", result.right]);
              logStore.reset();

              return result.right;
            })
            .catch((e) => {
              logStore.appendLog(["handler failed!: ", e]);
              logStore.reset();
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
          logStore: LogStore;
        }) => taskEither.TaskEither<unknown, R>
      ) => {
        return wrapperFunc((event: APIGatewayProxyEvent) => {
          const logStore = new LogStore(
            getPinoLogger({ name: "framework-node" }),
            500
          );
          logStore.appendLog(["parsing body: ", config.body]);

          const parsedBody = pipe(
            either.tryCatch(
              () => (event.body ? JSON.parse(event.body) : null),
              () => `event.body not JSON parsable: ${event.body}`
            ),
            either.chainW((jsonParsedBody) => parse(config.body, jsonParsedBody)),
            taskEither.fromEither,
            taskEither.map((v) => {
              logStore.appendLog(["parsed body successfully: ", v]);
              return v;
            }),
            taskEither.mapLeft((e) =>
              string.isString(e) ? e : `Incorrect Body Detail: ${draw(e)}`
            )
          );

          // we build the task making sure to have a readable error if the decoding fails
          const handlerTask = pipe(
            taskEither.Do,
            taskEither.bind("body", () => parsedBody),
            taskEither.bind("env", () =>
              config.envSchema
                ? parseRecordValues(config.envSchema, envRuntime, logStore)
                : taskEither.of(undefined)
            ),
            taskEither.bind("headers", () =>
              config.headers
                ? parseRecordValues(config.headers, event.headers, logStore)
                : taskEither.of(undefined)
            ),
            taskEither.chain((i) => handler({ ...i, logStore }))
          );

          // we throw in case of error
          return handlerTask()
            .then((result) => {
              if (either.isLeft(result)) {
                if (string.isString(result.left)) {
                  throw `[node-framework] ${result.left}`;
                } else {
                  logStore.appendLog(["unknown error...: ", result.left]);
                  throw new Error("[node-framework] handler unknown error");
                }
              }

              logStore.appendLog(["handler succeded with payload: ", result.right]);
              logStore.reset();

              return result.right;
            })
            .catch((e) => {
              logStore.appendLog(["handler failed!: ", e]);
              logStore.reset();
              throw e;
            });
        });
      };

export const _appSyncLambda =
  <A, R, K extends string = never>(
    wrapperFunc: WrapHandler<AppSyncResolverEvent<A>, R | void>,
    envRuntime = process.env
  ) =>
    (config: AppSyncLambdaConfig<A, K>) =>
      (
        handler: ({
          args,
          env,
        }: {
          args: A;
          env: Record<K, string> | undefined;
          logStore: LogStore;
        }) => taskEither.TaskEither<unknown, R>
      ) => {
        return wrapperFunc((event: AppSyncResolverEvent<A>) => {
          const logStore = new LogStore(
            getPinoLogger({ name: "framework-node" }),
            500
          );
          logStore.appendLog(["parsing args: ", config.args]);

          const parsedArgs = pipe(
            parse(config.args, event.arguments),
            taskEither.fromEither,
            taskEither.map((v) => {
              logStore.appendLog(["parsed args successfully: ", v]);
              return v;
            }),
            taskEither.mapLeft((e) =>
              string.isString(e) ? e : `Incorrect Args: ${draw(e)}`
            )
          );

          // we build the task making sure to have a readable error if the decoding fails
          const handlerTask = pipe(
            taskEither.Do,
            taskEither.bind("args", () => parsedArgs),
            taskEither.bind("env", () =>
              config.envSchema
                ? parseRecordValues(config.envSchema, envRuntime, logStore)
                : taskEither.of(undefined)
            ),
            taskEither.chain((i) => handler({ ...i, logStore }))
          );

          // we throw in case of error
          return handlerTask()
            .then((result) => {
              if (either.isLeft(result)) {
                if (string.isString(result.left)) {
                  throw `[node-framework] ${result.left}`;
                } else {
                  logStore.appendLog(["unknown error...: ", result.left]);
                  throw new Error("[node-framework] handler unknown error");
                }
              }

              logStore.appendLog(["handler succeded with payload: ", result.right]);
              logStore.reset();

              return result.right;
            })
            .catch((e) => {
              logStore.appendLog(["handler failed!: ", e]);
              logStore.reset();
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
      logStore: LogStore;
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<EventBridgeEvent<string, O>, R | void>;
};

export const getHttpLambda = <A, R, K extends string = never>(
  i: HttpLambdaConfig<A, K>
) => {
  return _httpLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      body: A;
      env: Record<K, string> | undefined;
      eventMeta: EventMeta;
      logStore: LogStore;
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<APIGatewayProxyEvent, R | void>;
};

export const getAppSyncLambda = <A, R, K extends string = never>(
  i: AppSyncLambdaConfig<A, K>
) => {
  return _appSyncLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      args: A;
      env: Record<K, string> | undefined;
      logStore: LogStore;
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<AppSyncResolverEvent<A>, R | void>;
};

export * from "./init";
export * from "./parse";
