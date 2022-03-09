import { taskEither } from "fp-ts";
import * as D from "io-ts/Decoder";
import { logger } from "../..";
import { decodeOrThrow } from "../../codecs/utils";
import AWS from "aws-sdk";
import {
  QueryInput,
  TransactWriteItem,
  TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";
import { Key } from "aws-sdk/clients/dynamodb";

interface DynamoIntrastructureInterface {
  putDbRows(
    i: TransactWriteItem[]
  ): taskEither.TaskEither<string, TransactWriteItemsOutput>;
  getDbRow(k: Key): taskEither.TaskEither<string, unknown>;
  query(k: QueryInput): taskEither.TaskEither<unknown, unknown>;
}

export class DynamoInfrastructure implements DynamoIntrastructureInterface {
  tableName: string;

  constructor(private appDynamoRepository: AWS.DynamoDB) {
    const env = decodeOrThrow(
      D.struct({
        AWS_DYNAMO_CATALOG_TABLE: D.string,
      }),
      process.env,
      "ProcessEnv"
    );

    this.tableName = env.AWS_DYNAMO_CATALOG_TABLE;
  }

  public putDbRows = (
    i: TransactWriteItem[]
  ): taskEither.TaskEither<string, TransactWriteItemsOutput> => {
    logger.info(`[node-framework] executing transaction ${JSON.stringify(i)}`);

    return taskEither.tryCatch(
      () =>
        this.appDynamoRepository
          .transactWriteItems({
            TransactItems: i,
          })
          .promise()
          .then((r) => {
            if (r.$response.error) {
              throw r.$response.error;
            }

            logger.info("[node-framework] putDbRows success: ", r);
            return r.$response.data as TransactWriteItemsOutput;
          })
          .catch((e) => {
            logger.info("[node-framework] putDbRows error: ", e);

            throw e;
          }),
      (e) => String(e)
    );
  };

  public getDbRow = (k: Key) => {
    const result = () => {
      logger.info(
        `[node-framework] getting item with keys ${JSON.stringify(k)}`
      );

      return this.appDynamoRepository
        .getItem({
          TableName: this.tableName,
          Key: k,
        })
        .promise()
        .then((result) => {
          if (result.Item) {
            const unmarshalledResult = AWS.DynamoDB.Converter.unmarshall(
              result.Item
            );
            logger.info(
              "[node-framework] row fetched from DB: ",
              unmarshalledResult
            );
            return unmarshalledResult;
          }

          throw `no row with keys = ${JSON.stringify(k)} in db`;
        });
    };

    return taskEither.tryCatch(
      result,
      (e) =>
        `[node-framework] Error fetching data from db: ${JSON.stringify(e)}`
    );
  };

  public query = (q: QueryInput) => {
    logger.info(`[node-framework] querying DB ${q}}`);

    const queryDB = () =>
      this.appDynamoRepository
        .query(q)
        .promise()
        .then((result) => {
          return result.Items
            ? result.Items.map((v) => AWS.DynamoDB.Converter.unmarshall(v))
            : undefined;
        })
        .then((r) => {
          logger.info(`[node-framework] successfully query`, r);

          return r;
        });

    return taskEither.tryCatch(queryDB, (e: any) => {
      logger.info(`[node-framework] failed querying the DB! ${e?.message}`, e);
      return e;
    });
  };
}
