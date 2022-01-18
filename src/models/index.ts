import * as D from "io-ts/Decoder";

export const NodeEnv = D.struct({
  NODE_ENV: D.union(
    D.literal("production"),
    D.literal("development"),
    D.literal("test")
  ),
});

export const AuroraEnv = D.intersect(NodeEnv)(
  D.struct({
    AURORA_HOSTNAME: D.string,
    AURORA_USERNAME: D.string,
    AURORA_PASSWORD: D.string,
    AURORA_DATABASE: D.string,
  })
);

export const AppSyncEnv = D.intersect(NodeEnv)(
  D.struct({
    AWS_APPSYNC_URL: D.string,
    AWS_APPSYNC_REGION: D.string,
  })
);

export const EventBridgeEnv = D.intersect(NodeEnv)(
  D.struct({
    AWS_EVENTBRIDGE_REGION: D.string,
  })
);
