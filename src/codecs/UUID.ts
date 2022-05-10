import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'
import { pipe } from 'fp-ts/function'

const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface UUIDBrand {
  readonly UUID: unique symbol
}

export type UUID = string & UUIDBrand

const decoder: D.Decoder<unknown, UUID> = pipe(
  D.string,
  D.refine((a): a is UUID => regex.test(a), 'UUID')
)

const encoder: E.Encoder<string, UUID> = {
  encode: C.string.encode,
}

export const UUID = C.make(decoder, encoder)
