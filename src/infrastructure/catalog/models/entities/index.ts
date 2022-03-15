import * as D from "io-ts/Decoder";
import { Category } from "./category";
import { Subcategory } from "./subcategory";
import { Microcategory } from "./microcategory";
import { Item } from "./item";
import { Tag } from "./tag";

export * from "./category";
export * from "./subcategory";
export * from "./microcategory";
export * from "./item";
export * from "./tag";

export const CategoryType = D.literal("category");
export const SubcategoryType = D.literal("subcategory");
export const MicrocategoryType = D.literal("microcategory");
export const ItemType = D.literal("item");
export const TagType = D.literal("tag");

const EntityType = D.union(
  CategoryType,
  SubcategoryType,
  MicrocategoryType,
  ItemType,
  TagType
);
export type EntityType = D.TypeOf<typeof EntityType>;

export const CategoryEntity = D.struct({
  type: CategoryType,
  body: Category,
});
export type CategoryEntity = D.TypeOf<typeof CategoryEntity>;

export const SubcategoryEntity = D.struct({
  type: SubcategoryType,
  body: Subcategory,
});
export type SubcategoryEntity = D.TypeOf<typeof SubcategoryEntity>;

export const MicrocategoryEntity = D.struct({
  type: MicrocategoryType,
  body: Microcategory,
});
export type MicrocategoryEntity = D.TypeOf<typeof MicrocategoryEntity>;

export const ItemEntity = D.struct({
  type: ItemType,
  body: Item,
});
export type ItemEntity = D.TypeOf<typeof ItemEntity>;

export const TagEntity = D.struct({
  type: TagType,
  body: Tag,
});
export type TagEntity = D.TypeOf<typeof TagEntity>;

const Entity = D.union(
  CategoryEntity,
  SubcategoryEntity,
  MicrocategoryEntity,
  ItemEntity,
  TagEntity
);
export type Entity = D.TypeOf<typeof Entity>;
