import { array, record, string, taskEither } from "fp-ts";
import * as D from "io-ts/Decoder";
import { decodeOrThrow } from "../../codecs/utils";
import AWS from "aws-sdk";
import {
  ExpressionAttributeNameMap,
  ExpressionAttributeValueMap,
  QueryInput,
  TransactWriteItem,
  TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";
import { Key } from "aws-sdk/clients/dynamodb";
import { CustomUpdate } from "../catalog/interface";
import { pipe } from "fp-ts/lib/function";
import { LogStore } from "../../Logger/LogStore";

interface DynamoIntrastructureInterface {
  putDbRows(
    i: TransactWriteItem[]
  ): taskEither.TaskEither<string, TransactWriteItemsOutput[]>;
  getDbRow(k: Key): taskEither.TaskEither<string, unknown>;
  query(
    k: Omit<QueryInput, "TableName">
  ): taskEither.TaskEither<string, unknown>;
  getNestedUpdateTransaction(k: {
    id: string;
    relation_id: string;
    customUpdate: CustomUpdate;
  }): TransactWriteItem;
}

export class DynamoInfrastructure implements DynamoIntrastructureInterface {
  tableName: string;

  constructor(
    private appDynamoRepository: AWS.DynamoDB,
    protected logStore: LogStore,
    DynamoTableEnvVar = "AWS_DYNAMO_CATALOG_TABLE"
  ) {
    const env = decodeOrThrow(
      D.struct({
        [DynamoTableEnvVar]: D.string,
      }),
      process.env,
      "ProcessEnv"
    );

    this.tableName = env[DynamoTableEnvVar];
  }

  public putDbRows = (
    i: TransactWriteItem[]
  ): taskEither.TaskEither<string, TransactWriteItemsOutput[]> => {
    this.logStore.appendLog([`executing transaction`, { transaction: i }]);

    if (i.length === 0) {
      return taskEither.left("no rows to update!");
    }

    return pipe(
      pipe(i, array.chunksOf(25)),
      array.traverse(taskEither.ApplicativeSeq)((transactItems) => {
        return taskEither.tryCatch(
          () =>
            this.appDynamoRepository
              .transactWriteItems({
                TransactItems: transactItems,
              })
              .promise()
              .then((r) => {
                if (r.$response.error) {
                  throw r.$response.error;
                }

                this.logStore.appendLog(["putDbRows success: ", { success: r }]);
                return r.$response.data as TransactWriteItemsOutput;
              })
              .catch((e) => {
                this.logStore.appendLog(["putDbRows error: ", { error: e }]);

                throw e;
              }),
          (e) => String(e)
        );
      })
    );
  };

  public getDbRow = (k: Key) => {
    const result = () => {
      this.logStore.appendLog([`getting item with keys ${JSON.stringify(k)}`]);

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
            this.logStore.appendLog([
              "row fetched from DB: ",
              unmarshalledResult,
            ]);
            return unmarshalledResult;
          }

          throw `no row with keys = ${JSON.stringify(k)} in db`;
        });
    };

    return taskEither.tryCatch(
      result,
      (e) => `Error fetching data from db: ${JSON.stringify(e)}`
    );
  };

  public query = (q: Omit<QueryInput, "TableName">) => {
    const query = { ...q, TableName: this.tableName };
    this.logStore.appendLog([`querying DB...`, { query }]);

    const queryDB = () =>
      this.appDynamoRepository
        .query(query)
        .promise()
        .then((result) => {
          if (result.$response.error) {
            throw result.$response.error;
          }
          return result.Items
            ? result.Items.map((v) => AWS.DynamoDB.Converter.unmarshall(v))
            : undefined;
        })
        .then((r) => {
          this.logStore.appendLog([`successful query`, { result: r }]);

          return r;
        });

    return taskEither.tryCatch(queryDB, (e) => {
      const printedError =
        e instanceof Error
          ? e.message
          : string.isString(e)
            ? e
            : "unknown error when querying the db";
      this.logStore.appendLog([
        `failed querying the DB! ${e instanceof Error ? e.message : e}`,
        { error: e }
      ]);
      return printedError;
    });
  };

  private getHashedUpdateKey = (s: string, i: number) => {
    const keyHashes = s
      .split(".")
      .map(
        (_, ii) =>
          `#${String.fromCharCode(97 + i)}${String.fromCharCode(97 + ii)}`
      );

    return keyHashes.join(".");
  };

  private getHashedAttributeNames = (key: string, index: number) => {
    return key.split(".").reduce(
      (acc, keypart, ii) => ({
        ...acc,
        [`#${String.fromCharCode(97 + index)}${String.fromCharCode(97 + ii)}`]:
          keypart,
      }),
      {}
    );
  };

  public getNestedUpdateTransaction = ({
    id,
    relation_id,
    customUpdate,
  }: {
    id: string;
    relation_id: string;
    customUpdate: CustomUpdate;
  }): TransactWriteItem => {
    this.logStore.appendLog(["applying nested update", customUpdate.values]);

    const updatesAsString = pipe(
      Object.entries(customUpdate.values),
      array.mapWithIndex((i, [keyValue, { condition }]) => {
        //needed to escape dash chars on uuids
        const updateKey = this.getHashedUpdateKey(keyValue, i);

        if (condition === "only_if_empty") {
          return `${updateKey} = if_not_exists(${updateKey}, :${String.fromCharCode(
            97 + i
          )})`;
        }

        return `${updateKey} = :${String.fromCharCode(97 + i)}`;
      })
    );
    const updateExpression = `SET ${updatesAsString.join(", ")}`;
    const attributeValues = pipe(
      customUpdate.values,
      record.toArray,
      array.reduceWithIndex({} as ExpressionAttributeValueMap, (i, b, a) => ({
        ...b,
        [`:${String.fromCharCode(97 + i)}`]: AWS.DynamoDB.Converter.input(
          a[1].value
        ),
      }))
    );
    const attributeNames = pipe(
      customUpdate.values,
      record.toArray,
      array.reduceWithIndex({} as ExpressionAttributeNameMap, (i, b, a) => ({
        ...b,
        ...this.getHashedAttributeNames(a[0], i),
      }))
    );

    return {
      Update: {
        TableName: this.tableName,
        Key: {
          id: {
            S: id,
          },
          relation_id: {
            S: relation_id,
          },
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
          ...attributeValues,
          ...customUpdate.generalCondition?.placeholders?.values,
        },
        ExpressionAttributeNames: {
          ...attributeNames,
          ...customUpdate.generalCondition?.placeholders?.names,
        },
        ConditionExpression: customUpdate.generalCondition?.expression,
      },
    };
  };
}
