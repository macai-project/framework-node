import { either, taskEither } from "fp-ts";
import {
  Item,
  Category,
  Subcategory,
  Tag,
  Microcategory,
  EntityType,
  Entity,
} from "./models/entities";
import {
  TransactWriteItem,
  TransactWriteItemsOutput,
} from "aws-sdk/clients/dynamodb";

export interface Replacement<V> {
  type: "replacement";
  newValue: V;
}
export interface PartialUpdate<V> {
  type: "partialUpdate";
  update: (oldValue: V) => V;
}
export interface CustomUpdate {
  type: "customUpdate";
  values: Record<string, any>;
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
