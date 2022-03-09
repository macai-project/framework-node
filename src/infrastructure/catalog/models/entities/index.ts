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
