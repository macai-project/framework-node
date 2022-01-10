import * as C from "io-ts/Codec";
import * as D from "io-ts/Decoder";
import * as E from "io-ts/Encoder";
import { pipe } from "fp-ts/function";

const decoder: D.Decoder<unknown, unknown> = pipe(
  D.string,
  D.parse((s) => {
    try {
      return D.success(JSON.parse(s));
    } catch (e) {
      return D.failure(s, `parsable into JSON`);
    }
  })
);

const encoder: E.Encoder<string, unknown> = {
  encode: String,
};

export const JSONFromString: C.Codec<unknown, string, unknown> = C.make(
  decoder,
  encoder
);
