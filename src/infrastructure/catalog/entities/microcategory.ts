import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const Microcategory = D.intersect(
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
export type Microcategory = D.TypeOf<typeof Microcategory>;
