export interface RealtimeEvent {
  event: string
  data: unknown
  id?: string
}

export class AsyncEventQueue<T> {
  private queue: T[] = []
  private waiters: ((item: T | null) => void)[] = []
  private closed = false

  push(item: T): void {
    if (this.closed) return
    const waiter = this.waiters.shift()
    if (waiter) {
      waiter(item)
    } else {
      this.queue.push(item)
    }
  }

  async next(): Promise<T | null> {
    if (this.queue.length > 0) {
      const item = this.queue.shift()
      return item !== undefined ? item : null
    }
    if (this.closed) return null
    return new Promise<T | null>((resolve) => {
      this.waiters.push(resolve)
    })
  }

  close(): void {
    this.closed = true
    while (this.waiters.length > 0) {
      const waiter = this.waiters.shift()
      if (waiter) waiter(null)
    }
  }

  isClosed(): boolean {
    return this.closed
  }
}

export class RealtimeService {
  private subscribers = new Set<AsyncEventQueue<RealtimeEvent>>()

  subscribe(queue: AsyncEventQueue<RealtimeEvent>): () => void {
    this.subscribers.add(queue)
    return () => {
      this.subscribers.delete(queue)
    }
  }

  broadcast(event: RealtimeEvent): void {
    for (const sub of this.subscribers) {
      if (!sub.isClosed()) {
        sub.push(event)
      }
    }
  }

  getActiveSubscriberCount(): number {
    return this.subscribers.size
  }

  closeAllSubscribers(): void {
    for (const sub of this.subscribers) {
      sub.close()
    }
    this.subscribers.clear()
  }

  resetSubscribers(): void {
    this.closeAllSubscribers()
  }
}

export const realtimeService = new RealtimeService()
