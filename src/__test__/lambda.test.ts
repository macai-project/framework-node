import { EventBridgeEvent } from "aws-lambda";
import { identity } from "fp-ts/function";
import { _lambda } from "..";
import * as C from "io-ts/Codec";
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

const getLambda = <O, A, R>() => _lambda<O, A, R>(wrapperMock);

describe("lambda", () => {
  it("returns the expected value when succeds", async () => {
    const detailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof detailSchema>;
    type ResultSchema = { result: "success!" };
    const handler = (_: DetailSchema) => {
      return taskEither.of({ result: "success!" as const });
    };
    const lambda = getLambda<DetailSchema, DetailSchema, ResultSchema>();

    const result = await lambda(handler, detailSchema)(
      getEventBridgeEvent({ foo: "foo", bar: 3 }),
      contextMock,
      callbackMock
    );

    expect(result).toEqual({ result: "success!" });
  });

  it("fails with the expected payload when the event is not well formatted", () => {
    const detailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof detailSchema>;
    type ResultSchema = { result: "success!" };
    const handler = (_: DetailSchema) => {
      return taskEither.of({ result: "success!" as const });
    };
    const lambda = getLambda<DetailSchema, DetailSchema, ResultSchema>();

    const result = lambda(handler, detailSchema)(
      getEventBridgeEvent({ foo: "foo" }) as any,
      contextMock,
      callbackMock
    );

    expect(result).rejects.toHaveProperty(
      "message",
      `Lambda failed with error: required property "bar"
└─ cannot decode undefined, should be number`
    );
  });

  it("fails with the expected payload when the handler fails", () => {
    const detailSchema = C.struct({ foo: C.string, bar: C.number });
    type DetailSchema = C.TypeOf<typeof detailSchema>;
    type ResultSchema = { result: "success!" };
    const handler = (_: DetailSchema) => {
      return taskEither.left("utter failure...." as const);
    };
    const lambda = getLambda<DetailSchema, DetailSchema, ResultSchema>();

    const result = lambda(handler, detailSchema)(
      getEventBridgeEvent({ foo: "foo", bar: 3 }),
      contextMock,
      callbackMock
    );

    expect(result).rejects.toHaveProperty(
      "message",
      "Lambda failed with error: utter failure...."
    );
  });
});
