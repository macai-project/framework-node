import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'
import { pipe } from 'fp-ts/function'

const decoder: D.Decoder<unknown, number> = pipe(
  D.string,
  D.parse((s) => {
    const n = parseFloat(s)
    return isNaN(n) ? D.failure(s, `parsable into a number`) : D.success(n)
  })
)

const encoder: E.Encoder<string, unknown> = {
  encode: String,
}

export const NumberFromString: C.Codec<unknown, string, number> = C.make(
  decoder,
  encoder
)
