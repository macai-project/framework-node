import * as D from "io-ts/Decoder";
import { DateFromISOString } from "../../../../codecs/DateFromISOString";
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

const BannerTagCommon = D.partial({
  order: D.number,
  title: D.string,
  description: D.string,
  image: D.boolean,
  backgroundColor: D.string,
  startDate: DateFromISOString,
  endDate: DateFromISOString,
  warehouseID: D.string,
});

export const BannerTagMandatory = {
  id: D.string,
  name: D.string,
  type: D.literal("banner"),
  state: D.union(EntityState, D.literal("archived")),
  body: D.union(
    D.intersect(D.struct({ subType: D.literal("product-collection") }))(
      BannerTagCommon
    ),
    D.intersect(D.struct({ subType: D.literal("subcategory") }))(
      BannerTagCommon
    )
  ),
};

export const BannerTagOptional = {};

export const BannerTagProps = {
  ...BannerTagMandatory,
  ...BannerTagOptional,
};

export const Tag = D.union(
  D.struct(InEvidenceTagProps),
  D.struct(BannerTagProps)
);
export type Tag = D.TypeOf<typeof Tag>;
