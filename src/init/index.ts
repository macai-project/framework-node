import 'cross-fetch/polyfill'
import * as Sentry from '@sentry/serverless'
import { DynamoDB } from 'aws-sdk'
import { createAppSyncClient, AppSyncClient } from './appsync'
import { createAuroraPool, MySQLPool } from './aurora'
import { createDynamoClient } from './dynamo'
import { createEventBridgeClient } from './eventBridge'

import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

type InitResult<
  A extends boolean,
  D extends boolean,
  AS extends boolean,
  EB extends boolean
> = (A extends false ? {} : { auroraPool: MySQLPool }) &
  (D extends false ? {} : { dynamo: DynamoDB }) &
  (AS extends false ? {} : { appSync: AppSyncClient }) &
  (EB extends false ? {} : { eventBridge: EventBridgeClient })

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
  aurora?: A
  dynamo?: D
  appSync?: AS
  eventBridge?: EB
  env?: Record<string, string | undefined>
}): InitResult<A, D, AS, EB> {
  Sentry.AWSLambda.init({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: 1.0,
  })

  const auroraPool = aurora && createAuroraPool(env)
  const dynamoClient = dynamo && createDynamoClient(env)
  const appSyncClient = appSync && createAppSyncClient(env)
  const eventBridgeClient = eventBridge && createEventBridgeClient(env)

  return {
    auroraPool,
    dynamo: dynamoClient,
    appSync: appSyncClient,
    eventBridge: eventBridgeClient,
  } as InitResult<A, D, AS, EB>
}
