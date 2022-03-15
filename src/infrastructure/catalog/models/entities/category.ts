import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const CategoryMandatory = {
  id: D.string,
  name: D.string,
  state: EntityState,
};

export const CategoryOptional = {
  color: D.string,
  order: D.number,
};

export const CategoryProps = {
  ...CategoryMandatory,
  ...CategoryOptional,
};

export const Category = D.intersect(D.struct(CategoryMandatory))(
  D.partial(CategoryOptional)
);
export type Category = D.TypeOf<typeof Category>;
