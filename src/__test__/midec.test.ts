import { MidecFromEAN } from '../utils/midec'

describe.only('utils/MidecFromEAN', () => {
  it('it returns a valid MIDEC from a EAN', async () => {
    const midec = MidecFromEAN('3259920039721')

    expect(midec).toBe('12bf955e-6b77-5831-87d3-9ead699e0aeb')
  })
})
