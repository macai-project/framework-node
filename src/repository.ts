import { captureMySQL } from "aws-xray-sdk";
import { decodeOrThrow } from "./codecs/utils";
import { AuroraEnv, NodeEnv } from "./models";
import AWSXRay from "aws-xray-sdk";
import mysql from "mysql";
import AWS, { DynamoDB } from "aws-sdk";

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

  const dynamoClient =
    env.NODE_ENV === "production"
      ? AWSXRay.captureAWSClient(new AWS.DynamoDB())
      : new AWS.DynamoDB();

  return dynamoClient;
};
