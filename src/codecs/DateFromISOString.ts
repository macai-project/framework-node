import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'

const decoder: D.Decoder<unknown, Date> = pipe(
  D.string,
  D.parse((s) => {
    const d = new Date(s)
    return isNaN(d.getTime())
      ? D.failure(s, `parsable into a Date`)
      : D.success(d)
  })
)

const encoder: E.Encoder<string, Date> = {
  encode: (a) => a.toISOString(),
}

export const DateFromISOString: C.Codec<unknown, string, Date> = C.make(
  decoder,
  encoder
)
