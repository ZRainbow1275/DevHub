import { describe, expect, it } from 'vitest'
import { RingBuffer } from './RingBuffer'

describe('RingBuffer', () => {
  it('should preserve insertion order before the buffer wraps', () => {
    const buffer = new RingBuffer<number>(3)

    buffer.push(10)
    buffer.push(20)

    expect(buffer.snapshot()).toEqual({
      capacity: 3,
      size: 2,
      items: [10, 20],
      wrapped: false
    })
  })

  it('should overwrite the oldest item after capacity is exceeded', () => {
    const buffer = new RingBuffer<number>(3)

    buffer.push(1)
    buffer.push(2)
    buffer.push(3)
    buffer.push(4)

    expect(buffer.snapshot()).toEqual({
      capacity: 3,
      size: 3,
      items: [2, 3, 4],
      wrapped: true
    })
  })

  it('should reset state after clear', () => {
    const buffer = new RingBuffer<string>(2)

    buffer.push('alpha')
    buffer.push('beta')
    buffer.push('gamma')
    buffer.clear()

    expect(buffer.snapshot()).toEqual({
      capacity: 2,
      size: 0,
      items: [],
      wrapped: false
    })
  })

  it('should reject non-positive capacities', () => {
    expect(() => new RingBuffer<number>(0)).toThrow('RingBuffer capacity must be a positive integer')
    expect(() => new RingBuffer<number>(-1)).toThrow('RingBuffer capacity must be a positive integer')
  })
})
