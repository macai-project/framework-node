import * as C from "io-ts/Codec";
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

export const CategoryType = C.literal("category");
export const SubcategoryType = C.literal("subcategory");
export const MicrocategoryType = C.literal("microcategory");
export const ItemType = C.literal("item");
export const TagType = C.literal("tag");

const EntityType = C.literal(
  "category",
  "subcategory",
  "microcategory",
  "item",
  "tag"
);
export type EntityType = C.TypeOf<typeof EntityType>;

export const CategoryEntity = C.struct({
  type: CategoryType,
  body: Category,
});
export type CategoryEntity = C.TypeOf<typeof CategoryEntity>;

export const SubcategoryEntity = C.struct({
  type: SubcategoryType,
  body: Subcategory,
});
export type SubcategoryEntity = C.TypeOf<typeof SubcategoryEntity>;

export const MicrocategoryEntity = C.struct({
  type: MicrocategoryType,
  body: Microcategory,
});
export type MicrocategoryEntity = C.TypeOf<typeof MicrocategoryEntity>;

export const ItemEntity = C.struct({
  type: ItemType,
  body: Item,
});
export type ItemEntity = C.TypeOf<typeof ItemEntity>;

export const TagEntity = C.struct({
  type: TagType,
  body: Tag,
});
export type TagEntity = C.TypeOf<typeof TagEntity>;

export const Entity = C.sum("type")({
  category: CategoryEntity,
  subcategory: SubcategoryEntity,
  microcategory: MicrocategoryEntity,
  item: ItemEntity,
  tag: TagEntity,
});
export type Entity = C.TypeOf<typeof Entity>;
