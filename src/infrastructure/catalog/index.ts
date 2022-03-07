import { either, option, taskEither } from "fp-ts";
import * as D from "io-ts/Decoder";
import { decodeOrDraw } from "../../codecs/utils";
import { CatalogIntrastructureInterface } from "./model";
import { Entity, EntityType } from "./entities";
import AWS from "aws-sdk";
import { pipe } from "fp-ts/function";
import {
  TransactWriteItem,
  TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";
import { filterMap } from "fp-ts/Array";
import { traverse } from "fp-ts/lib/Record";
import { DynamoInfrastructure } from "../dynamo";

const parTraverse = traverse(taskEither.ApplicativePar);

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
      return either.left("[node-framework] no updates defined!");
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

    console.log("[node-framework] created transaction", transaction);

    return either.right(transaction);
  }

  private putRelation(i: {
    id: string;
    relation_id: string;
    source_data?: Record<string, unknown>;
    target_data?: Record<string, unknown>;
  }): taskEither.TaskEither<string, TransactWriteItemsOutput> {
    const transaction = this.getDbPutTransaction(i);

    return pipe(
      taskEither.fromEither(transaction),
      taskEither.chain(this.putDbRow)
    );
  }

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
      parTraverse((v) => this.getDBRowSourceData("it", v.type, v.id)),
      taskEither.chain(({ sourceData, targetData }) =>
        this.putRelation({
          id: this.getDynamoId(
            "it",
            i.relationSource.type,
            i.relationSource.id
          ),
          relation_id: this.getDynamoId(
            "it",
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
      id: this.getDynamoId("it", e.type, id),
      relation_id: this.getDynamoEntityTag("it", e.type),
      source_data: e.body,
    });

    return pipe(
      taskEither.fromEither(transaction),
      taskEither.chain(this.putDbRow)
    );
  };
  removeEntity = () => {
    return taskEither.left("not yet implemented");
  };
  updateEntity = () => {
    return taskEither.left("not yet implemented");
  };
}
