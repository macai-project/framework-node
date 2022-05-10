import * as C from 'io-ts/Codec'
import { draw } from 'io-ts/lib/Decoder'
import { NumberFromString } from '../..'
import { Strict } from '../codec'

describe.only('Strict codec', () => {
  it('when parsing a valid payload, it returns the expected right', async () => {
    const codec = Strict({ foo: NumberFromString, bar: C.string })
    const parsed = codec.decode({ foo: '12', bar: 'baz' })

    expect(parsed).toEqual({ _tag: 'Right', right: { foo: 12, bar: 'baz' } })
  })
  it('when parsing an invalid payload, it returns the expected left', async () => {
    const codec = Strict({ foo: NumberFromString, bar: C.string })
    const parsed = codec.decode({ foo: 'zebra', bar: 'baz' })

    expect(draw((parsed as any).left)).toEqual(`required property \"foo\"
└─ cannot decode \"zebra\", should be parsable into a number`)
  })
  it('when parsing a payload with unknown keys, it returns the expected left', async () => {
    const codec = Strict({ foo: NumberFromString, bar: C.string })
    const parsed = codec.decode({ foo: '1', bar: 'baz', azz: 'marauz' })

    expect(draw((parsed as any).left)).toEqual(
      `cannot decode {"foo":"1","bar":"baz","azz":"marauz"}, should be without the unknown keys: "azz"`
    )
  })
})
