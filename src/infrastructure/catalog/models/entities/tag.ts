import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const Tag = D.union(
  D.struct({
    id: D.string,
    name: D.string,
    type: D.literal("in-evidence"),
    state: D.union(EntityState, D.literal("coming-soon", "archived")),
    body: D.partial({ order: D.number }),
  })
);
export type Tag = D.TypeOf<typeof Tag>;
