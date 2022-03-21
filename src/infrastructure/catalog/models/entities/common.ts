import * as C from "io-ts/Codec";

export const EntityState = C.literal("published", "draft");
export type EntityState = C.TypeOf<typeof EntityState>;
