import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const Subcategory = D.intersect(
  D.struct({
    id: D.string,
    name: D.string,
    state: EntityState,
  })
)(
  D.partial({
    order: D.number,
  })
);
export type Subcategory = D.TypeOf<typeof Subcategory>;
