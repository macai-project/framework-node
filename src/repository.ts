import AWS, { DynamoDB, Credentials } from "aws-sdk";
import { captureMySQL } from "aws-xray-sdk";
import AWSAppSyncClient from "aws-appsync";
import AWSXRay from "aws-xray-sdk";
import mysql from "mysql";
import "cross-fetch/polyfill";

import { decodeOrThrow } from "./codecs/utils";
import { AppSyncEnv, AuroraEnv, NodeEnv } from "./models";

export type Connection = captureMySQL.PatchedPoolConnection;
export type MySQLPool = captureMySQL.PatchedPool;

export const createAuroraPool = (): MySQLPool => {
  const env = decodeOrThrow(AuroraEnv, process.env);

  const mysqlClient =
    env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

  return mysqlClient.createPool({
    connectionLimit: 2,
  });
};

export const createDynamoClient = (): DynamoDB => {
  const env = decodeOrThrow(NodeEnv, process.env);
  const params =
    process.env.NODE_ENV === "development"
      ? {
          endpoint: "http://localstack:4566",
          region: "eu-west-1",
          credentials: {
            accessKeyId: "test",
            secretAccessKey: "test",
          },
        }
      : undefined;

  const dynamoClient =
    env.NODE_ENV === "production"
      ? AWSXRay.captureAWSClient(new AWS.DynamoDB(params))
      : new AWS.DynamoDB(params);

  return dynamoClient;
};

export const createAppSyncClient = (): AWSAppSyncClient<any> => {
  const env = decodeOrThrow(AppSyncEnv, process.env);
  const credentials = new Credentials(
    env.AWS_ACCESS_KEY_ID,
    env.AWS_SECRET_ACCESS_KEY,
    env.AWS_SESSION_TOKEN
  );

  AWS.config.update(
    env.NODE_ENV === "production"
      ? {
          region: env.AWS_APPSYNC_REGION,
          credentials,
        }
      : {
          region: "eu-west-1",
          credentials: {
            accessKeyId: "test",
            secretAccessKey: "test",
          },
        }
  );

  const appSyncClient = new AWSAppSyncClient(
    {
      url:
        env.NODE_ENV === "production"
          ? env.AWS_APPSYNC_URL
          : "http://locastack:4566",
      region: env.AWS_APPSYNC_REGION,
      auth: {
        type: "AWS_IAM",
        credentials,
      },
      disableOffline: true,
    },
    {
      defaultOptions: {
        query: {
          fetchPolicy: "network-only",
          errorPolicy: "all",
        },
      },
    }
  );

  return appSyncClient;
};
