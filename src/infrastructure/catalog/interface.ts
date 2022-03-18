import { taskEither } from "fp-ts";
import { EntityType, Entity } from "./models/entities";
import {
  AttributeName,
  AttributeValue,
  TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";

export interface Replacement<V> {
  type: "replacement";
  newValue: V;
}

/**
 * Accepts an updater function that is called with the current body of the item
 *
 * @deprecated Use a {@link CustomUpdate} instead.
 */
export interface PartialUpdate<V> {
  type: "partialUpdate";
  update: (oldValue: V) => V;
}

type HashedKey = `#${string}`;
type ColumnedKey = `:${string}`;
export interface CustomUpdate {
  type: "customUpdate";
  generalCondition?: {
    expression: string;
    placeholders?: {
      namePlaceholders?: { [key: HashedKey]: AttributeName };
      valuePlaceholders?: { [key: ColumnedKey]: AttributeValue };
    };
  };
  values: Record<string, { value: any; condition?: "only_if_empty" }>;
}

export type EntityUpdate<V> = Replacement<V> | PartialUpdate<V> | CustomUpdate;

export interface CatalogIntrastructureInterface {
  removeRelation(
    source: { type: EntityType; id: string },
    target: { type: EntityType; id: string }
  ): taskEither.TaskEither<string, void>;
  createRelation(i: {
    relationSource: { type: EntityType; id: string };
    relationTarget: { type: EntityType; id: string };
  }): taskEither.TaskEither<string, TransactWriteItemsOutput>;

  removeEntity(t: EntityType, id: string): taskEither.TaskEither<string, void>;
  createEntity(
    id: string,
    e: Entity
  ): taskEither.TaskEither<string, TransactWriteItemsOutput>;
  updateEntity<E extends Entity>(
    i: {
      type: E["type"];
      id: string;
    },
    u: EntityUpdate<E["body"]>
  ): taskEither.TaskEither<string, TransactWriteItemsOutput>;
}
