import {
  EventBridgeEvent,
  APIGatewayProxyEvent,
  AppSyncResolverEvent,
} from 'aws-lambda'
import * as Sentry from '@sentry/serverless'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import { parse } from './parse'
import { pipe } from 'fp-ts/lib/function'
import { string, either, taskEither } from 'fp-ts'
import { draw } from 'io-ts/lib/Decoder'
import { WrapHandler } from './handler'
import { traverseWithIndex } from 'fp-ts/lib/Record'
import { DateFromISOString } from './codecs/DateFromISOString'
import { decodeOrThrow } from './codecs/utils'
import { LogStore } from './Logger/LogStore'
import { getPinoLogger } from './Logger/Logger'

type SchemaRecord<K extends string> = Record<K, C.Codec<unknown, any, any>>
type EventLambdaConfig<A, K extends string> = {
  eventDetailSchema: D.Decoder<unknown, A>
  envSchema?: SchemaRecord<K>
}
type HttpLambdaConfig<
  A,
  K extends string,
  U extends string,
  H extends string
> = {
  body: D.Decoder<unknown, A>
  rawBody?: string
  queryparams?: SchemaRecord<H>
  headers?: SchemaRecord<U>
  envSchema?: SchemaRecord<K>
}

type AppSyncLambdaConfig<A, K extends string> = {
  args: D.Decoder<unknown, A>
  envSchema?: SchemaRecord<K>
}

const parTraverse = traverseWithIndex(taskEither.ApplicativePar)

const parseSchemaRecord = <K extends string>(
  recordType: string,
  schemaRecord: Record<K, D.Decoder<unknown, string>>,
  runtimeValue: {
    [key: string]: string | undefined
  },
  logStore: LogStore
): taskEither.TaskEither<string, Record<K, string>> => {
  return pipe(
    schemaRecord,
    parTraverse((key, codec) => {
      const decoderRecord = D.struct({ [key]: codec })
      logStore.appendLog([`parsing ${recordType}: `, schemaRecord])

      return pipe(
        parse(decoderRecord, { [key]: runtimeValue[key] }),
        taskEither.fromEither,
        taskEither.map((v) => {
          logStore.appendLog([`parsed ${recordType} successfully!`])
          return v[key]
        })
      )
    }),
    taskEither.mapLeft((e) => {
      return `incorrect ${recordType} runtime: ${draw(e)}`
    })
  )
}

export type EventMeta = {
  id: string
  version: string
  account: string
  time: Date
  region: string
  resources: string[]
  source: string
  'detail-type': string
}

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
      event: A
      eventMeta: EventMeta
      env: Record<K, string> | undefined
      logStore: LogStore
    }) => taskEither.TaskEither<unknown, R>
  ) => {
    return wrapperFunc((event: EventBridgeEvent<string, O>) => {
      const logStore = new LogStore(
        getPinoLogger({ name: 'framework-node' }),
        500
      )

      logStore.appendLog(['parsing event: ', { event: event.detail }])

      const eventMeta = {
        ...event,
        time: decodeOrThrow(DateFromISOString, event.time),
        detail: undefined,
      }

      const parsedEvent = pipe(
        parse(eventDetailSchema, event.detail),
        taskEither.fromEither,
        taskEither.map((v) => {
          logStore.appendLog(['parsed event successfully: ', { event: v }])
          return v
        }),
        taskEither.mapLeft((e) => `Incorrect Event Detail: ${draw(e)}`)
      )

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        taskEither.Do,
        taskEither.bind('event', () => parsedEvent),
        taskEither.bind('eventMeta', () => taskEither.of(eventMeta)),
        taskEither.bind('env', () =>
          envSchema
            ? parseSchemaRecord<K>('Env', envSchema, envRuntime, logStore)
            : taskEither.of(undefined)
        ),
        taskEither.chain((i) => handler({ ...i, logStore }))
      )

      // we throw in case of error
      return handlerTask()
        .then((result) => {
          if (either.isLeft(result)) {
            if (string.isString(result.left)) {
              throw `[node-framework] ${result.left}`
            } else {
              logStore.appendLog(['unknown error...: ', { error: result.left }])
              throw new Error('[node-framework] handler unknown error')
            }
          }

          logStore.appendLog([
            'handler succeded with payload: ',
            { success: result.right },
          ])
          logStore.reset()

          return result.right
        })
        .catch((e) => {
          logStore.appendLog(['handler failed!: ', e])
          logStore.reset()
          throw e
        })
    })
  }

export const _httpLambda =
  <
    A,
    R,
    K extends string = never,
    U extends string = never,
    H extends string = never
  >(
    wrapperFunc: WrapHandler<APIGatewayProxyEvent, R | void>,
    envRuntime = process.env
  ) =>
  (config: HttpLambdaConfig<A, K, U, H>) =>
  (
    handler: ({
      body,
      rawBody,
      queryparams,
      headers,
      env,
    }: {
      body: A
      rawBody: string
      queryparams: Record<H, string> | undefined
      headers: Record<U, string> | undefined
      env: Record<K, string> | undefined
      logStore: LogStore
    }) => taskEither.TaskEither<unknown, R>
  ) => {
    return wrapperFunc((event: APIGatewayProxyEvent) => {
      const logStore = new LogStore(
        getPinoLogger({ name: 'framework-node' }),
        500
      )
      logStore.appendLog(['parsing body: ', { body: config.body }])

      const parsedBody = pipe(
        either.tryCatch(
          () => (event.body ? JSON.parse(event.body) : null),
          () => `event.body not JSON parsable: ${event.body}`
        ),
        either.chainW((jsonParsedBody) => parse(config.body, jsonParsedBody)),
        taskEither.fromEither,
        taskEither.map((v) => {
          logStore.appendLog(['parsed body successfully: ', { body: v }])
          return v
        }),
        taskEither.mapLeft((e) =>
          string.isString(e) ? e : `Incorrect Body Detail: ${draw(e)}`
        )
      )

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        taskEither.Do,
        taskEither.bind('body', () => parsedBody),
        taskEither.bind('rawBody', () => taskEither.of(event.body || '')),
        taskEither.bind('env', () =>
          config.envSchema
            ? parseSchemaRecord<K>(
                'Env',
                config.envSchema,
                envRuntime,
                logStore
              )
            : taskEither.of(undefined)
        ),
        taskEither.bind('queryparams', () =>
          config.queryparams
            ? parseSchemaRecord<H>(
                'Query Params',
                config.queryparams,
                event.queryStringParameters || {},
                logStore
              )
            : taskEither.of(undefined)
        ),
        taskEither.bind('headers', () =>
          config.headers
            ? parseSchemaRecord<U>(
                'Headers',
                config.headers,
                event.headers,
                logStore
              )
            : taskEither.of(undefined)
        ),
        taskEither.chain((i) => handler({ ...i, logStore }))
      )

      // we throw in case of error
      return handlerTask()
        .then((result) => {
          if (either.isLeft(result)) {
            if (string.isString(result.left)) {
              throw `[node-framework] ${result.left}`
            } else {
              logStore.appendLog(['unknown error...: ', { error: result.left }])
              throw new Error('[node-framework] handler unknown error')
            }
          }

          logStore.appendLog([
            'handler succeded with payload: ',
            { success: result.right },
          ])
          logStore.reset()

          return result.right
        })
        .catch((e) => {
          logStore.appendLog(['handler failed!: ', e])
          logStore.reset()
          throw e
        })
    })
  }

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
      args: A
      env: Record<K, string> | undefined
      logStore: LogStore
    }) => taskEither.TaskEither<unknown, R>
  ) => {
    return wrapperFunc((event: AppSyncResolverEvent<A>) => {
      const logStore = new LogStore(
        getPinoLogger({ name: 'framework-node' }),
        500
      )
      logStore.appendLog(['parsing args: ', { args: config.args }])

      const parsedArgs = pipe(
        parse(config.args, event.arguments),
        taskEither.fromEither,
        taskEither.map((v) => {
          logStore.appendLog(['parsed args successfully: ', { args: v }])
          return v
        }),
        taskEither.mapLeft((e) =>
          string.isString(e) ? e : `Incorrect Args: ${draw(e)}`
        )
      )

      // we build the task making sure to have a readable error if the decoding fails
      const handlerTask = pipe(
        taskEither.Do,
        taskEither.bind('args', () => parsedArgs),
        taskEither.bind('env', () =>
          config.envSchema
            ? parseSchemaRecord<K>(
                'Env',
                config.envSchema,
                envRuntime,
                logStore
              )
            : taskEither.of(undefined)
        ),
        taskEither.chain((i) => handler({ ...i, logStore }))
      )

      // we throw in case of error
      return handlerTask()
        .then((result) => {
          if (either.isLeft(result)) {
            if (string.isString(result.left)) {
              logStore.appendLog(['handler error: ', { error: result.left }])
              throw new Error(result.left)
            } else {
              logStore.appendLog(['unknown error...: ', { error: result.left }])
              throw new Error('[node-framework] handler unknown error')
            }
          }

          logStore.appendLog([
            'handler succeded with payload: ',
            { success: result.right },
          ])
          logStore.reset()

          return result.right
        })
        .catch((e) => {
          logStore.appendLog(['handler failed!: ', e])
          logStore.reset()
          throw e
        })
    })
  }

export const getEventLambda = <O, A, R, K extends string = never>(
  i: EventLambdaConfig<A, K>
) => {
  return _eventLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      event: A
      env: Record<K, string> | undefined
      eventMeta: EventMeta
      logStore: LogStore
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<EventBridgeEvent<string, O>, R | void>
}

export const getHttpLambda = <
  A,
  R,
  K extends string = never,
  U extends string = never,
  H extends string = never
>(
  i: HttpLambdaConfig<A, K, U, H>
) => {
  return _httpLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      body: A
      rawBody?: string
      env: Record<K, string> | undefined
      headers: Record<U, string> | undefined
      queryparams: Record<H, string> | undefined
      eventMeta: EventMeta
      logStore: LogStore
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<APIGatewayProxyEvent, R | void>
}

export const getAppSyncLambda = <A, R, K extends string = never>(
  i: AppSyncLambdaConfig<A, K>
) => {
  return _appSyncLambda(Sentry.AWSLambda.wrapHandler)(i) as unknown as (
    f: (i: {
      args: A
      env: Record<K, string> | undefined
      logStore: LogStore
    }) => taskEither.TaskEither<unknown, R>
  ) => WrapHandler<AppSyncResolverEvent<A>, R | void>
}

export * from './init'
export * from './parse'
export * from './codecs'

export { MidecFromEAN, UUID_V5_NAMESPACE } from './utils/midec'
