export interface WebhookHistoryRecord {
  id: string
  type: 'inbound' | 'status'
  messageId: string
  targetUrl: string
  statusCode: number
  createdAt: string
  payload?: Record<string, unknown>
  error?: string
}

export class WebhookHistoryStore {
  private items: WebhookHistoryRecord[] = []

  add(record: WebhookHistoryRecord): void {
    this.items.unshift(record)
    if (this.items.length > 100) {
      this.items.pop()
    }
  }

  getAll(): WebhookHistoryRecord[] {
    return [...this.items]
  }

  clear(): void {
    this.items = []
  }
}

export const webhookHistoryStore = new WebhookHistoryStore()
