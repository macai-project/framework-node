import { either, option, record, string, taskEither } from "fp-ts";
import * as D from "io-ts/Decoder";
import { decodeOrDraw } from "../../codecs/utils";
import {
  CatalogIntrastructureInterface,
  CustomUpdate,
  EntityUpdate,
  PartialUpdate,
  Replacement,
} from "./interface";
import {
  Category,
  Entity,
  EntityType,
  Item,
  Microcategory,
  Subcategory,
  Tag,
} from "./models/entities";
import AWS from "aws-sdk";
import { absurd, pipe } from "fp-ts/function";
import {
  TransactWriteItem,
  TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";
import { filterMap } from "fp-ts/Array";
import { traverse } from "fp-ts/lib/Record";
import { DynamoInfrastructure } from "../dynamo";
import { isString } from "fp-ts/lib/string";
import { sequenceS } from "fp-ts/lib/Apply";
import { Countries } from "./models/Countries";
import { debug } from "../../logger";

const parTraverse = traverse(taskEither.ApplicativePar);
const parSequence = sequenceS(taskEither.ApplicativePar);
const reduceRecord = record.reduceWithIndex(string.Ord);

export const TableEntryIDs = D.struct({
  id: D.string,
  relation_id: D.string,
});
export type TableEntryIDs = D.TypeOf<typeof TableEntryIDs>;

export class CatalogInfrastructure
  extends DynamoInfrastructure
  implements CatalogIntrastructureInterface
{
  private getDynamoEntityTag(country: string, type: EntityType): string {
    return `${country}#${type}`;
  }

  private getDynamoId(country: string, type: EntityType, id: string): string {
    return `${this.getDynamoEntityTag(country, type)}#${id}`;
  }

  private getDbPutTransaction(i: {
    id: string;
    relation_id: string;
    source_data?: {
      [key: string]: any;
    };
    target_data?: {
      [key: string]: any;
    };
  }): either.Either<string, TransactWriteItem> {
    const updates = pipe(
      [
        i.source_data
          ? {
              expressionAttribute: "source",
              fieldName: "source_data",
              data: { M: AWS.DynamoDB.Converter.marshall(i.source_data) },
            }
          : undefined,
        i.target_data
          ? {
              expressionAttribute: "target",
              fieldName: "target_data",
              data: { M: AWS.DynamoDB.Converter.marshall(i.target_data) },
            }
          : undefined,
      ],
      filterMap(option.fromNullable)
    );

    if (updates.length === 0) {
      return either.left("no updates defined!");
    }

    const transaction: TransactWriteItem = {
      Update: {
        TableName: this.tableName,
        Key: {
          id: {
            S: i.id,
          },
          relation_id: {
            S: i.relation_id,
          },
        },
        UpdateExpression: `set ${updates
          .map((u) => `${u.fieldName} = :${u.expressionAttribute}`)
          .join(", ")}`,
        ExpressionAttributeValues: updates.reduce(
          (acc, v) => ({
            ...acc,
            [`:${v.expressionAttribute}`]: v.data,
          }),
          {}
        ),
      },
    };

    console.log("created transaction", transaction);

    return either.right(transaction);
  }

  private putRelation(i: {
    id: string;
    relation_id: string;
    source_data?: Record<string, unknown>;
    target_data?: Record<string, unknown>;
  }): taskEither.TaskEither<string, TransactWriteItemsOutput[]> {
    const transaction = this.getDbPutTransaction(i);

    return pipe(
      taskEither.fromEither(transaction),
      taskEither.chain((t) => this.putDbRows([t]))
    );
  }

  private getDbRowIds(i: {
    type: "id" | "relation_id";
    value: string;
  }): taskEither.TaskEither<string, TableEntryIDs[]> {
    const indexName = i.type === "id" ? undefined : "relation_id-id";
    const expressionAttributeValues = {
      ":k": { S: i.value },
    };
    const keyConditionExpression =
      i.type === "id" ? "id = :k" : "relation_id = :k";

    const queryInput = {
      IndexName: indexName,
      ExpressionAttributeValues: expressionAttributeValues,
      KeyConditionExpression: keyConditionExpression,
      ProjectionExpression: "id, relation_id",
    };

    debug(`getDBRows`, queryInput);

    const getDBRows = this.query(queryInput);

    return pipe(
      getDBRows,
      taskEither.chain((v) =>
        taskEither.fromEither(D.array(TableEntryIDs).decode(v))
      ),
      taskEither.mapLeft((v) => D.draw(v))
    );
  }

  private getEntityDecoder = <E extends Entity>(
    type: E["type"]
  ): D.Decoder<unknown, E["body"]> => {
    switch (type) {
      case "category":
        return Category;
      case "subcategory":
        return Subcategory;
      case "microcategory":
        return Microcategory;
      case "item":
        return Item;
      case "tag":
        return Tag;
      default:
        return absurd(type);
    }
  };

  private applyUpdater = <E extends Entity>(
    updater: Replacement<E["body"]> | PartialUpdate<E["body"]>,
    currentBody: E["body"]
  ): E["body"] => {
    switch (updater.type) {
      case "replacement":
        return updater.newValue;
      case "partialUpdate":
        return updater.update(currentBody);
    }
  };

  private getUpdatedBody = <E extends Entity>(
    itemId: string,
    type: E["type"],
    updater: Replacement<E["body"]> | PartialUpdate<E["body"]>
  ): taskEither.TaskEither<string, E["body"]> => {
    const decoder = this.getEntityDecoder(type);
    const dbRow = this.getDbRow({
      id: {
        S: itemId,
      },
      relation_id: {
        S: this.getDynamoEntityTag(Countries.it, type),
      },
    });

    return pipe(
      dbRow,
      taskEither.chainW((v) =>
        taskEither.fromEither(decoder.decode(v?.source_data))
      ),
      taskEither.bimap(
        (e) => (isString(e) ? e : D.draw(e)),
        (v) => this.applyUpdater(updater, v)
      )
    );
  };

  private getTransactionFromCustomUpdate = ({
    id,
    relation_id,
    customUpdate,
    transactionType,
  }: {
    id: string;
    relation_id: string;
    customUpdate: CustomUpdate;
    transactionType: "inward" | "outward";
  }): TransactWriteItem => {
    const dataToUpdate =
      transactionType === "inward" ? "target_data" : "source_data";

    return this.getNestedUpdateTransaction({
      id,
      relation_id,
      customUpdate: {
        ...customUpdate,
        values: pipe(
          customUpdate.values,
          reduceRecord({}, (k, acc, v) => ({
            ...acc,
            [`${v.noDrill ? "" : `${dataToUpdate}.`}${k}`]: v,
          }))
        ),
      },
    });
  };

  /**
   * [IDEMPOTENT] get only the row IDS to be updated from the db then applies the updates
   *
   * @param itemId
   * @param type
   * @param updater
   * @returns the TransactWriteItem operations to perform on the DB
   */
  private getEntityCustomUpdateOperations = <E extends Entity>(
    itemId: string,
    customUpdate: CustomUpdate
  ): taskEither.TaskEither<string, TransactWriteItem[]> => {
    const outwardRelations = this.getDbRowIds({ type: "id", value: itemId });

    // inward directed relations
    const inwardRelations = this.getDbRowIds({
      type: "relation_id",
      value: itemId,
    });

    return pipe(
      parSequence({ outwardRelations, inwardRelations }),
      taskEither.map(({ outwardRelations, inwardRelations }) => {
        const outwardTransactions = outwardRelations.map(
          ({ id, relation_id }) => {
            return this.getTransactionFromCustomUpdate({
              id,
              relation_id,
              customUpdate,
              transactionType: "outward",
            });
          }
        );

        const inwardTransactions = inwardRelations.map(
          ({ id, relation_id }) => {
            return this.getTransactionFromCustomUpdate({
              id,
              relation_id,
              customUpdate,
              transactionType: "inward",
            });
          }
        );

        return outwardTransactions.concat(inwardTransactions);
      })
    );
  };

  /**
   * [NOT-IDEMPOTENT] get the entity data from the db and applies the selected update
   *
   * @param itemId
   * @param type
   * @param updater
   * @returns the TransactWriteItem operations to perform on the DB
   */
  private getEntityUpdateOperations = <E extends Entity>(
    itemId: string,
    type: E["type"],
    updater: Replacement<E["body"]> | PartialUpdate<E["body"]>
  ): taskEither.TaskEither<string, TransactWriteItem[]> => {
    const updatedBody = this.getUpdatedBody(itemId, type, updater);
    // outward directed relations and items entities
    const outwardRelations = this.getDbRowIds({ type: "id", value: itemId });
    // inward directed relations
    const inwardRelations = this.getDbRowIds({
      type: "relation_id",
      value: itemId,
    });

    return pipe(
      parSequence({ updatedBody, outwardRelations, inwardRelations }),
      taskEither.map(({ updatedBody, outwardRelations, inwardRelations }) => {
        const outwardTransactions = outwardRelations.map(
          ({ id, relation_id }) => {
            const operation: TransactWriteItem = {
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
                UpdateExpression: "set source_data = :x",
                ExpressionAttributeValues: {
                  ":x": {
                    M: AWS.DynamoDB.Converter.marshall(
                      Entity.encode({ type, body: updatedBody } as Entity)
                    ),
                  },
                },
              },
            };
            return operation;
          }
        );

        const inwardTransactions = inwardRelations.map(
          ({ id, relation_id }) => {
            const operation: TransactWriteItem = {
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
                UpdateExpression: "set target_data = :x",
                ExpressionAttributeValues: {
                  ":x": { M: AWS.DynamoDB.Converter.marshall(updatedBody) },
                },
              },
            };
            return operation;
          }
        );

        return outwardTransactions.concat(inwardTransactions);
      })
    );
  };

  private getEntityOrRelation(id: string, relation_id: string) {
    return this.getDbRow({
      id: {
        S: id,
      },
      relation_id: {
        S: relation_id,
      },
    });
  }

  constructor(appCatalogRepository: AWS.DynamoDB) {
    super(appCatalogRepository);
  }

  getDBRowSourceData = (country: string, type: EntityType, id: string) => {
    const entityId = this.getDynamoId(country, type, id);

    const entityFromDB = this.getEntityOrRelation(
      this.getDynamoId(country, type, id),
      this.getDynamoEntityTag(country, type)
    );

    const currentItem = pipe(
      entityFromDB,
      taskEither.chainW((v) => {
        return pipe(
          decodeOrDraw(
            D.struct({ source_data: D.UnknownRecord }),
            v,
            `${entityId} source_data`
          ),
          taskEither.fromEither
        );
      })
    );

    return currentItem;
  };

  removeRelation = () => {
    return taskEither.left("not yet implemented");
  };

  createRelation = (i: {
    relationSource: { type: EntityType; id: string };
    relationTarget: { type: EntityType; id: string };
  }) => {
    const result = pipe(
      { sourceData: i.relationSource, targetData: i.relationTarget },
      parTraverse((v) => this.getDBRowSourceData(Countries.it, v.type, v.id)),
      taskEither.chain(({ sourceData, targetData }) =>
        this.putRelation({
          id: this.getDynamoId(
            Countries.it,
            i.relationSource.type,
            i.relationSource.id
          ),
          relation_id: this.getDynamoId(
            Countries.it,
            i.relationTarget.type,
            i.relationTarget.id
          ),
          source_data: sourceData.source_data,
          target_data: targetData.source_data,
        })
      )
    );
    return result;
  };

  createEntity = (id: string, e: Entity) => {
    const transaction = this.getDbPutTransaction({
      id: this.getDynamoId(Countries.it, e.type, id),
      relation_id: this.getDynamoEntityTag(Countries.it, e.type),
      source_data: Entity.encode(e).body,
    });

    return pipe(
      taskEither.fromEither(transaction),
      taskEither.chain((t) => this.putDbRows([t]))
    );
  };
  removeEntity = () => {
    return taskEither.left("not yet implemented");
  };

  private getTransactionsForUpdater = <E extends Entity>(
    entity: {
      type: E["type"];
      id: string;
    },
    updater: EntityUpdate<Entity["body"]>
  ) => {
    const updateType = updater.type;

    switch (updateType) {
      case "partialUpdate":
      case "replacement": {
        return this.getEntityUpdateOperations(
          this.getDynamoId(Countries.it, entity.type, entity.id),
          entity.type,
          updater
        );
      }
      case "customUpdate": {
        return this.getEntityCustomUpdateOperations(
          this.getDynamoId(Countries.it, entity.type, entity.id),
          updater
        );
      }
      default:
        absurd(updateType);
        return updateType;
    }
  };

  updateEntity = <E extends Entity>(
    entity: {
      type: E["type"];
      id: string;
    },
    updater: EntityUpdate<E["body"]>
  ) => {
    const rowsToUpdate = this.getTransactionsForUpdater(entity, updater);

    return pipe(rowsToUpdate, taskEither.chain(this.putDbRows));
  };
}
