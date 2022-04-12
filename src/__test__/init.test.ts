import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { init } from "../init";

describe.only("init", () => {
  it("when initialized with eventBridge === true, it returns a eventBridge client", async () => {
    const result = init({
      eventBridge: true,
      env: { AWS_EVENTBRIDGE_REGION: "eu-west-1", NODE_ENV: "test" },
    });

    expect(result.eventBridge).toBeInstanceOf(EventBridgeClient);
  });
});
