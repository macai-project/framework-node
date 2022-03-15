import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const SubcategoryMandatory = {
  id: D.string,
  name: D.string,
  state: EntityState,
};

export const SubcategoryOptional = {
  order: D.number,
};

export const SubcategoryProps = {
  ...SubcategoryMandatory,
  ...SubcategoryOptional,
};

export const Subcategory = D.intersect(D.struct(SubcategoryMandatory))(
  D.partial(SubcategoryOptional)
);
export type Subcategory = D.TypeOf<typeof Subcategory>;
