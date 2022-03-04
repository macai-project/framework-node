import { either } from "fp-ts";
import { Item, Category, Subcategory, Tag, Microcategory } from "./entities";
import { TransactWriteItem } from "aws-sdk/clients/dynamodb";

export interface CategoryEntity {
  type: "category";
  body: Category;
}
export interface SubcategoryEntity {
  type: "subcategory";
  body: Subcategory;
}
export interface MicrocategoryEntity {
  type: "microcategory";
  body: Microcategory;
}
export interface ItemEntity {
  type: "item";
  body: Item;
}
export interface TagEntity {
  type: "tag";
  body: Tag;
}

export type Entity =
  | CategoryEntity
  | SubcategoryEntity
  | MicrocategoryEntity
  | ItemEntity
  | TagEntity;

export type EntityType = Entity["type"];

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
}

export type EntityUpdate<V> = Replacement<V> | PartialUpdate<V>;

export interface CatalogIntrastructureInterface {
  removeRelation(
    source: { type: EntityType; id: string },
    target: { type: EntityType; id: string }
  ): either.Either<string, void>;
  createRelation(
    source: { type: EntityType; id: string },
    target: { type: EntityType; id: string }
  ): either.Either<string, void>;

  removeRelation(t: EntityType, id: string): either.Either<string, void>;
  createEntity(e: Entity): either.Either<string, void>;
  updateEntity<E extends Entity>(
    i: {
      type: E["type"];
      id: string;
    },
    u: EntityUpdate<E["body"]>
  ): either.Either<string, void>;
}
