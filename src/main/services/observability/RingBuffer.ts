import type { RingBufferSnapshot } from '@shared/observability'

export class RingBuffer<T> {
  private head = 0
  private length = 0
  private wrapped = false
  private readonly values: T[]

  constructor(private readonly capacityValue: number) {
    if (!Number.isInteger(capacityValue) || capacityValue <= 0) {
      throw new Error('RingBuffer capacity must be a positive integer')
    }
    this.values = new Array<T>(capacityValue)
  }

  get capacity(): number {
    return this.capacityValue
  }

  clear(): void {
    this.head = 0
    this.length = 0
    this.wrapped = false
  }

  push(item: T): void {
    this.values[this.head] = item
    this.head = (this.head + 1) % this.capacityValue

    if (this.length < this.capacityValue) {
      this.length += 1
    } else {
      this.wrapped = true
    }
  }

  snapshot(): RingBufferSnapshot<T> {
    const items = this.toArray()

    return Object.freeze({
      capacity: this.capacityValue,
      size: this.length,
      items: Object.freeze(items),
      wrapped: this.wrapped
    })
  }

  private toArray(): T[] {
    if (this.length === 0) {
      return []
    }

    if (this.length < this.capacityValue) {
      return this.values.slice(0, this.length)
    }

    return [
      ...this.values.slice(this.head),
      ...this.values.slice(0, this.head)
    ]
  }
}
