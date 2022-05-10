import { Either } from 'fp-ts/Either'
import * as D from 'io-ts/Decoder'
import { DecodeError } from 'io-ts/Decoder'

export function parse<T>(
  schema: D.Decoder<unknown, T>,
  event: any
): Either<DecodeError, T> {
  return schema.decode(event)
}
