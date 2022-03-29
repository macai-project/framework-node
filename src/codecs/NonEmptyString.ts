import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";
import { pipe } from "fp-ts/lib/function";

interface NonEmptyStringBrand {
  readonly NonEmptyString: unique symbol
}
type NonEmptyString = string & NonEmptyStringBrand

const decoder: D.Decoder<unknown, NonEmptyString> = pipe(
  D.string,
  D.refine((s): s is NonEmptyString => s.length > 0, 'NonEmptyString')
)
const encoder: E.Encoder<string, NonEmptyString> = {
  encode: C.string.encode
}
const NonEmptyString = C.make(decoder, encoder)
