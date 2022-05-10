import { EventBridgeClient } from '@aws-sdk/client-eventbridge'

import { decodeOrThrow } from '../codecs/utils'
import { EventBridgeEnv } from '../models'

export const createEventBridgeClient = (
  _env: Record<string, string | undefined>
) => {
  const env = decodeOrThrow(EventBridgeEnv, _env)
  const isProd = env.NODE_ENV === 'production'
  const isStaging = env.NODE_ENV === 'staging'

  const params =
    isProd || isStaging
      ? { region: env.AWS_EVENTBRIDGE_REGION }
      : {
          endpoint: 'http://localstack:4566',
          region: 'eu-west-1',
          credentials: {
            accessKeyId: 'test',
            secretAccessKey: 'test',
          },
        }

  const client = new EventBridgeClient(params)

  return client
}
