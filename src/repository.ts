import https from "https";
import AWS, { DynamoDB } from "aws-sdk";
import SignerV4 from "aws-sdk/lib/signers/v4";
import { captureMySQL } from "aws-xray-sdk";
import AWSXRay from "aws-xray-sdk";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import mysql from "mysql";
import url from "url";
import "cross-fetch/polyfill";

import { decodeOrThrow } from "./codecs/utils";
import { AppSyncEnv, AuroraEnv, EventBridgeEnv, NodeEnv } from "./models";

export type Connection = captureMySQL.PatchedPoolConnection;
export type MySQLPool = captureMySQL.PatchedPool;
export type AWSAppSyncClient = {
  query: <T>(params: { query: any; variables: T }) => Promise<unknown>;
};

export const createAuroraPool = (
  _env: Record<string, string | undefined>
): MySQLPool => {
  const env = decodeOrThrow(AuroraEnv, _env);

  const mysqlClient =
    env.NODE_ENV === "production" ? AWSXRay.captureMySQL(mysql) : mysql;

  return mysqlClient.createPool({
    connectionLimit: 2,
  });
};

export const createDynamoClient = (
  _env: Record<string, string | undefined>
): DynamoDB => {
  const env = decodeOrThrow(NodeEnv, _env);
  const isProd = env.NODE_ENV === "production";
  const params = isProd
    ? undefined
    : {
        endpoint: "http://localstack:4566",
        region: "eu-west-1",
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
      };

  const dynamoClient = new AWS.DynamoDB(params);

  return isProd ? AWSXRay.captureAWSClient(dynamoClient) : dynamoClient;
};

export const createEventBridgeClient = (
  _env: Record<string, string | undefined>
) => {
  const env = decodeOrThrow(EventBridgeEnv, _env);
  const isProd = env.NODE_ENV === "production";
  const params = isProd
    ? { region: env.AWS_EVENTBRIDGE_REGION }
    : {
        endpoint: "http://localstack:4566",
        region: "eu-west-1",
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
      };

  const client = new EventBridgeClient(params);

  return client;
};
export const createAppSyncClient = (
  _env: Record<string, string | undefined>
) => {
  const env = decodeOrThrow(AppSyncEnv, _env);

  const query = <T>({ query, variables }: { query: any; variables: T }) => {
    const endpoint = new url.URL(env.AWS_APPSYNC_URL).hostname.toString();
    const req = new AWS.HttpRequest(
      new AWS.Endpoint(env.AWS_APPSYNC_URL as string),
      env.AWS_APPSYNC_REGION as string
    );

    req.method = "POST";
    req.path = "/graphql";
    req.headers.host = endpoint;
    req.headers["Content-Type"] = "application/json";
    req.body = JSON.stringify({
      query,
      variables,
    });

    const signer = new SignerV4(req, "appsync", true);
    signer.addAuthorization(AWS.config.credentials, new Date());

    return new Promise((resolve, reject) => {
      const httpRequest = https.request(
        { ...req, host: endpoint },
        (result) => {
          let data = "";

          result.on("data", (chunk) => {
            data += chunk;
          });

          result.on("end", () => {
            const response: { data: any; errors?: any[] } = JSON.parse(
              data.toString()
            );
            if (response.errors && response.errors.length > 0) {
              reject(response.errors);
            } else {
              resolve(response.data);
            }
          });
        }
      );
      httpRequest.on("error", reject);

      httpRequest.write(req.body);
      httpRequest.end();
    });
  };

  return {
    query,
  };
};
