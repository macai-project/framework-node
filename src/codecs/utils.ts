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
  payload: unknown
): O => {
  const result = codec.decode(payload);

  if (result._tag === "Left") {
    throw D.draw(result.left);
  }

  return result.right;
};
