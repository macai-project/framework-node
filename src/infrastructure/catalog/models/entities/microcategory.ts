import * as C from 'io-ts/Codec'
import { EntityState } from './common'

export const MicrocategoryMandatory = {
  id: C.string,
  name: C.string,
  state: EntityState,
}

export const MicrocategoryOptional = {
  order: C.number,
}

export const MicrocategoryProps = {
  ...MicrocategoryMandatory,
  ...MicrocategoryOptional,
}

export const Microcategory = C.intersect(C.struct(MicrocategoryMandatory))(
  C.partial(MicrocategoryOptional)
)
export type Microcategory = C.TypeOf<typeof Microcategory>
