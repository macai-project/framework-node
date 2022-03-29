import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";
import { pipe } from "fp-ts/lib/function";

const NonEmptyStringDecoder: D.Decoder<unknown, string> =
  pipe(
    D.string,
    D.parse(s => s.length > 0 ? D.success(s) : D.failure(s, "Empty string"))
  )
const NonEmptyStringEncoder: E.Encoder<string, string> = { encode: C.string.encode }

export const NonEmptyString: C.Codec<unknown, string, string> = C.make(NonEmptyStringDecoder, NonEmptyStringEncoder)
