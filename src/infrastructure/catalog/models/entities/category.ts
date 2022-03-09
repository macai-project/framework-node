import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const Category = D.intersect(
  D.struct({
    id: D.string,
    name: D.string,
    state: EntityState,
  })
)(
  D.partial({
    color: D.string,
    order: D.number,
  })
);
export type Category = D.TypeOf<typeof Category>;
