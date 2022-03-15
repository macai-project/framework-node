import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const MicrocategoryMandatory = {
  id: D.string,
  name: D.string,
  state: EntityState,
};

export const MicrocategoryOptional = {
  order: D.number,
};

export const MicrocategoryProps = {
  ...MicrocategoryMandatory,
  ...MicrocategoryOptional,
};

export const Microcategory = D.intersect(D.struct(MicrocategoryMandatory))(
  D.partial(MicrocategoryOptional)
);
export type Microcategory = D.TypeOf<typeof Microcategory>;
