import { captureMySQL } from 'aws-xray-sdk'
import mysql from 'mysql'

import { decodeOrThrow } from '../codecs/utils'
import { AuroraEnv } from '../models'

export type Connection = captureMySQL.PatchedPoolConnection
export type MySQLPool = captureMySQL.PatchedPool

export const createAuroraPool = (
  _env: Record<string, string | undefined>
): MySQLPool => {
  const env = decodeOrThrow(AuroraEnv, _env)
  const isProd = env.NODE_ENV === 'production'
  const isStaging = env.NODE_ENV === 'staging'
  const mysqlClient = isProd || isStaging ? captureMySQL(mysql) : mysql

  return mysqlClient.createPool({
    connectionLimit: 2,
    host: env.AURORA_HOSTNAME,
    user: env.AURORA_USERNAME,
    password: env.AURORA_PASSWORD,
    database: env.AURORA_DATABASE,
  })
}
