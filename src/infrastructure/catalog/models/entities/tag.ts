import * as C from "io-ts/Codec";
import { DateFromISOString } from "../../../../codecs/DateFromISOString";
import { EntityState } from "./common";

export const InEvidenceTagMandatory = {
  id: C.string,
  name: C.string,
  type: C.literal("in-evidence"),
  state: C.literal("published", "draft", "coming-soon", "archived"),
  body: C.partial({ order: C.number }),
};

export const InEvidenceTagOptional = {};

export const InEvidenceTagProps = {
  ...InEvidenceTagMandatory,
  ...InEvidenceTagOptional,
};

const BannerTagCommon = C.partial({
  order: C.number,
  title: C.string,
  description: C.string,
  image: C.boolean,
  background: C.array(C.string),
  template: C.literal("1/2", "2/3"),
  startDate: DateFromISOString,
  endDate: DateFromISOString,
  warehouseID: C.string,
});

export const BannerTagMandatory = {
  id: C.string,
  name: C.string,
  type: C.literal("banner"),
  state: C.literal("published", "draft", "archived"),
  body: C.sum("subType")({
    "product-collection": C.intersect(
      C.struct({ subType: C.literal("product-collection") })
    )(BannerTagCommon),
    "microcategory-collection": C.intersect(
      C.struct({ subType: C.literal("microcategory-collection") })
    )(BannerTagCommon),
    subcategory: C.intersect(C.struct({ subType: C.literal("subcategory") }))(
      BannerTagCommon
    ),
    link: C.intersect(C.struct({ subType: C.literal("link") }))(
      C.intersect(C.struct({ path: C.string }))(BannerTagCommon)
    ),
  }),
};

export const BannerTagOptional = {};

export const BannerTagProps = {
  ...BannerTagMandatory,
  ...BannerTagOptional,
};

export const Tag = C.sum("type")({
  "in-evidence": C.struct(InEvidenceTagProps),
  banner: C.struct(BannerTagProps),
});
export type Tag = C.TypeOf<typeof Tag>;
