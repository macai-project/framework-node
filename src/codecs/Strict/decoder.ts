import * as E from 'fp-ts/Either'
import * as S from 'fp-ts/string'
import * as R from 'fp-ts/Record'
import * as A from 'fp-ts/Array'
import { pipe } from 'fp-ts/lib/function'
import * as D from 'io-ts/Decoder'
import * as C from 'io-ts/Codec'

export interface StrictDecoderBrand {
  readonly StrictDecoder: unique symbol
}

export type OutputStrict<A extends Props<string>> = StrictDecoderBrand & {
  [k in keyof A]: C.TypeOf<A[k]>
}

export interface Mixed extends C.Codec<unknown, any, any> {}

export type Props<K extends string> = {
  [k in K]: Mixed
}

export const Strict = <D extends Props<string>>(
  d: D
): D.Decoder<unknown, OutputStrict<D>> => {
  const originalDecoder = D.struct(d)
  const noForeignKeys: D.Decoder<unknown, object> = {
    decode: (v: unknown) => {
      const originalResult = originalDecoder.decode(v)

      if (E.isLeft(originalResult)) {
        return originalResult
      }

      const decoderKeys = pipe(d, R.keys)

      if (typeof v === 'object' && v !== null) {
        const valueKeys = pipe(v, R.keys)
        const unknownKeys = pipe(valueKeys, A.difference(S.Eq)(decoderKeys))

        return unknownKeys.length === 0
          ? originalResult
          : D.failure(
              v,
              `without the unknown keys: ${unknownKeys
                .map((k) => `"${k}"`)
                .join(', ')}`
            )
      }

      return D.failure(v, 'object')
    },
  }

  return pipe(
    noForeignKeys,
    D.refine((n): n is OutputStrict<D> => true, 'Strict')
  )
}
