import * as S from "fp-ts/string";
import * as R from "fp-ts/Record";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import * as E from "io-ts/Encoder";
import { OutputStrict, Props } from "./decoder";

export interface StrictEncoderBrand {
  readonly StrictEncoder: unique symbol;
}

type InputStrict<O extends Props<string>> = {
  [k in keyof O]: E.OutputOf<O[k]>;
};

export const Strict = <D extends Props<string>>(
  d: D
): E.Encoder<InputStrict<D>, OutputStrict<D>> => {
  const encoder = E.struct(d);

  return {
    encode: (i: OutputStrict<D>) => encoder.encode(i),
  };
};
