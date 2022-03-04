import { either } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import * as D from "io-ts/Decoder";

/**
 * Try to decode the payload with the given io-ts codec
 *
 * ```
 * decodeOrThrow(t.interface({ name: t.string }), { name: "John"}) // { name: "John" }
 * decodeOrThrow(t.interface({ name: t.string }), { name: undefined }) // throw Error
 * ```
 * @param codec An io-ts codec
 * @param payload the entity to decode
 *
 * @return the payload when successfully decoded or throw an error
 *
 */
export const decodeOrThrow = <O>(
  codec: D.Decoder<unknown, O>,
  payload: unknown,
  codecName?: string
): O => {
  const result = codec.decode(payload);

  if (result._tag === "Left") {
    throw codecName
      ? `Wrong ${codecName}: ${D.draw(result.left)}`
      : D.draw(result.left);
  }

  return result.right;
};

/**
 * Try to decode the payload with the given io-ts codec, if fails draw a human readable error
 *
 * ```
 * decodeOrThrow(t.interface({ name: t.string }), { name: "John"}) // { name: "John" }
 * decodeOrThrow(t.interface({ name: t.string }), { name: undefined }) // throw Error
 * ```
 * @param codec An io-ts codec
 * @param payload the entity to decode
 *
 * @return the payload when successfully decoded or a human readable error
 *
 */
export const decodeOrDraw = <O>(
  codec: D.Decoder<unknown, O>,
  payload: unknown,
  codecName?: string
): either.Either<string, O> => {
  return pipe(
    codec.decode(payload),
    either.mapLeft((e) => {
      return codecName ? `Wrong ${codecName}: ${D.draw(e)}` : D.draw(e);
    })
  );
};
