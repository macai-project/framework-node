import { EventBridgeEvent } from "aws-lambda";
import { identity } from "fp-ts/function";
import { _lambda } from "..";
import * as C from "io-ts/Codec";
import { NumberFromString } from "../codecs";
import { taskEither } from "fp-ts";

const wrapperMock = identity;
const contextMock: any = undefined;
const callbackMock: any = undefined;
const getEventBridgeEvent = <D>(detail: D): EventBridgeEvent<string, D> => ({
  id: "mock",
  version: "mock",
  account: "mock",
  time: "mock",
  region: "mock",
  resources: [],
  source: "mock",
  "detail-type": "mock",
  detail,
});

const getLambda = <O, A, R, E extends string = never>(e?: NodeJS.ProcessEnv) =>
  _lambda<O, A, R, E>(wrapperMock, e);

describe("lambda", () => {
  it("given lambda, when handler is successful and event has correct payload, lambda returns the expected value", async () => {
    const eventDetailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof eventDetailSchema>;
    type ResultSchema = { result: "success!" };
    const handler = (_: { event: DetailSchema }) => {
      return taskEither.of({ result: "success!" as const });
    };
    const lambda = getLambda<DetailSchema, DetailSchema, ResultSchema>();

    const result = await lambda({ eventDetailSchema })(handler)(
      getEventBridgeEvent({ foo: "foo", bar: 3 }),
      contextMock,
      callbackMock
    );

    expect(result).toEqual({ result: "success!" });
  });

  it("given lambda, when handler is successful but event has incorrect payload, lambda returns the expected error", () => {
    const eventDetailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof eventDetailSchema>;
    type ResultSchema = { result: "success!" };
    const handler = (_: { event: DetailSchema }) => {
      return taskEither.of({ result: "success!" as const });
    };
    const lambda = getLambda<DetailSchema, DetailSchema, ResultSchema>();

    const result = lambda({ eventDetailSchema })(handler)(
      getEventBridgeEvent({ foo: "foo" }) as any,
      contextMock,
      callbackMock
    );

    expect(result).rejects.toBe(
      `Incorrect Event Detail: required property "bar"
└─ cannot decode undefined, should be number`
    );
  });

  it("given lambda, when handler fails and event has correct payload, lambda returns the expected error", () => {
    const eventDetailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof eventDetailSchema>;
    type ResultSchema = { result: "success!" };
    const handler = (_: { event: DetailSchema }) => {
      return taskEither.left("utter failure...." as const);
    };
    const lambda = getLambda<DetailSchema, DetailSchema, ResultSchema>();

    const result = lambda({ eventDetailSchema })(handler)(
      getEventBridgeEvent({ foo: "foo", bar: 3 }),
      contextMock,
      callbackMock
    );

    expect(result).rejects.toBe("utter failure....");
  });

  it("given lambda, when handler is successful and event has correct payload but env is incorrect, lambda returns the expected error", () => {
    const eventDetailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof eventDetailSchema>;
    const envSchema = {
      RANDOM_ENV_VAR: C.string,
      RANDOM_ENV_VAR_2: NumberFromString,
    };
    type EnvSchemaKeys = keyof typeof envSchema;
    type ResultSchema = { result: "success!" };
    const handler = (_: { event: DetailSchema }) => {
      return taskEither.left("utter failure...." as const);
    };
    const lambda = getLambda<
      DetailSchema,
      DetailSchema,
      ResultSchema,
      EnvSchemaKeys
    >({ RANDOM_ENV_VAR: "baz", RANDOM_ENV_VAR_2: "foo" });

    const result = lambda({ eventDetailSchema, envSchema })(handler)(
      getEventBridgeEvent({ foo: "foo", bar: 3 }),
      contextMock,
      callbackMock
    );

    expect(result).rejects.toBe(
      `Incorrect Env runtime: required property "RANDOM_ENV_VAR_2"
└─ cannot decode "foo", should be parsable into a number`
    );
  });

  it("given lambda, when handler is successful and event has correct payload and env is correct, lambda returns the expected env values", async () => {
    const eventDetailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof eventDetailSchema>;
    const envSchema = {
      RANDOM_ENV_VAR: C.string,
      RANDOM_ENV_VAR_2: NumberFromString,
    };
    type EnvSchemaKeys = keyof typeof envSchema;
    type ResultSchema = { result: "success!" };
    const handler = (_: { event: DetailSchema }) => {
      return taskEither.of({ result: "success!" as const });
    };
    const lambda = getLambda<
      DetailSchema,
      DetailSchema,
      ResultSchema,
      EnvSchemaKeys
    >({
      RANDOM_ENV_VAR: "baz",
      RANDOM_ENV_VAR_2: "2",
    });

    const result = await lambda({ eventDetailSchema })(handler)(
      getEventBridgeEvent({ foo: "foo", bar: 3 }),
      contextMock,
      callbackMock
    );

    expect(result).toEqual({ result: "success!" });
  });
});
