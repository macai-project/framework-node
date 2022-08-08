import { v5 as uuidv5 } from 'uuid'

export const UUID_V5_NAMESPACE = '00000000-0000-0000-0000-000000000000'

export function MidecFromEAN(ean: string): string {
  return uuidv5(ean, UUID_V5_NAMESPACE)
}
