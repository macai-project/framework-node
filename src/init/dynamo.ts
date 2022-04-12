import AWS, { DynamoDB } from "aws-sdk";
import { captureAWSClient } from "aws-xray-sdk";

import { decodeOrThrow } from "../codecs/utils";
import { NodeEnv } from "../models";

export const createDynamoClient = (
  _env: Record<string, string | undefined>
): DynamoDB => {
  const env = decodeOrThrow(NodeEnv, _env);
  const isProd = env.NODE_ENV === "production";
  const isStaging = env.NODE_ENV === "staging";
  const params =
    isProd || isStaging
      ? undefined
      : {
          endpoint: "http://localstack:4566",
          maxRetries: 3,
          region: "eu-west-1",
          credentials: {
            accessKeyId: "test",
            secretAccessKey: "test",
          },
        };

  const dynamoClient = new AWS.DynamoDB(params);

  return isProd || isStaging ? captureAWSClient(dynamoClient) : dynamoClient;
};
