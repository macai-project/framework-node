import * as C from 'io-ts/Codec'
import { Strict as StrictDecoder, Props, OutputStrict } from './decoder'
import { InputStrict, Strict as StrictEncoder } from './encoder'

export const Strict = <D extends Props<string>>(
  p: D
): C.Codec<unknown, InputStrict<D>, OutputStrict<D>> => {
  return C.make(StrictDecoder(p), StrictEncoder(p))
}
