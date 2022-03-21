import * as C from "io-ts/Codec";
import { EntityState } from "./common";

export const SubcategoryMandatory = {
  id: C.string,
  name: C.string,
  state: EntityState,
};

export const SubcategoryOptional = {
  order: C.number,
};

export const SubcategoryProps = {
  ...SubcategoryMandatory,
  ...SubcategoryOptional,
};

export const Subcategory = C.intersect(C.struct(SubcategoryMandatory))(
  C.partial(SubcategoryOptional)
);
export type Subcategory = C.TypeOf<typeof Subcategory>;
