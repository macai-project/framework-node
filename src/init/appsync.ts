import https from 'https'
import AWS from 'aws-sdk'
import SignerV4 from 'aws-sdk/lib/signers/v4'
import url from 'url'
import 'cross-fetch/polyfill'

import { decodeOrThrow } from '../codecs/utils'
import { AppSyncEnv } from '../models'

export type AppSyncClient = {
  query: <T>(params: { query: any; variables: T }) => Promise<unknown>
}

export const createAppSyncClient = (
  _env: Record<string, string | undefined>
) => {
  const env = decodeOrThrow(AppSyncEnv, _env)

  const query = <T>({ query, variables }: { query: any; variables: T }) => {
    const endpoint = new url.URL(env.AWS_APPSYNC_URL).hostname.toString()
    const req = new AWS.HttpRequest(
      new AWS.Endpoint(env.AWS_APPSYNC_URL as string),
      env.AWS_APPSYNC_REGION as string
    )

    req.method = 'POST'
    req.path = '/graphql'
    req.headers.host = endpoint
    req.headers['Content-Type'] = 'application/json'
    req.body = JSON.stringify({
      query,
      variables,
    })

    const signer = new SignerV4(req, 'appsync', true)
    signer.addAuthorization(AWS.config.credentials, new Date())

    return new Promise((resolve, reject) => {
      const httpRequest = https.request(
        { ...req, host: endpoint },
        (result) => {
          let data = ''

          result.on('data', (chunk) => {
            data += chunk
          })

          result.on('end', () => {
            const response: { data: any; errors?: any[] } = JSON.parse(
              data.toString()
            )
            if (response.errors && response.errors.length > 0) {
              reject(response.errors)
            } else {
              resolve(response.data)
            }
          })
        }
      )
      httpRequest.on('error', reject)

      httpRequest.write(req.body)
      httpRequest.end()
    })
  }

  return {
    query,
  }
}
