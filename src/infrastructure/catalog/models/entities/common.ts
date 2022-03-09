import * as D from "io-ts/Decoder";

export const EntityState = D.literal("published", "draft");
export type EntityState = D.TypeOf<typeof EntityState>;
