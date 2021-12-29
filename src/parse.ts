import { Either } from "fp-ts/Either";
import * as C from "io-ts/Codec";
import { DecodeError } from "io-ts/Decoder";

export function parse<T>(
  schema: C.Codec<unknown, unknown, T>,
  event: any
): Either<DecodeError, T> {
  return schema.decode(event);
}
