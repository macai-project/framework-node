import * as D from "io-ts/Decoder";
import { EntityState } from "./common";

export const InEvidenceTagMandatory = {
  id: D.string,
  name: D.string,
  type: D.literal("in-evidence"),
  state: D.union(EntityState, D.literal("coming-soon", "archived")),
  body: D.partial({ order: D.number }),
};

export const InEvidenceTagOptional = {};

export const InEvidenceTagProps = {
  ...InEvidenceTagMandatory,
  ...InEvidenceTagOptional,
};

export const Tag = D.union(D.struct(InEvidenceTagProps));
export type Tag = D.TypeOf<typeof Tag>;
