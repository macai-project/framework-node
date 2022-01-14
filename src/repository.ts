import https from "https";
import AWS, { DynamoDB } from "aws-sdk";
import SignerV4 from "aws-sdk/lib/signers/v4";
import { captureMySQL } from "aws-xray-sdk";
import AWSXRay from "aws-xray-sdk";
import mysql from "mysql";
import url from "url";
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

export const createAppSyncClient = () => {
  const env = decodeOrThrow(AppSyncEnv, process.env);

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
