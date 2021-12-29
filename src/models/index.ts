import * as D from "io-ts/Decoder";

export const NodeEnv = D.struct({
  NODE_ENV: D.union(D.literal("production"), D.literal("development")),
});

export const AuroraEnv = D.intersect(NodeEnv)(
  D.struct({
    AURORA_HOSTNAME: D.string,
    AURORA_USERNAME: D.string,
    AURORA_PASSWORD: D.string,
    AURORA_DATABASE: D.string,
  })
);