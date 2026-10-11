export interface SentMessageRecord {
  id: string
  phoneNumberId: string
  messageId: string
  to: string
  type: string
  payload: Record<string, unknown>
  createdAt: string
}

export class MessageStore {
  private messages: SentMessageRecord[] = []

  add(record: Omit<SentMessageRecord, 'id' | 'createdAt'>): SentMessageRecord {
    const entry: SentMessageRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...record,
    }
    this.messages.push(entry)
    return entry
  }

  getSentMessages(phoneNumberId?: string): SentMessageRecord[] {
    if (!phoneNumberId) return [...this.messages]
    return this.messages.filter((m) => m.phoneNumberId === phoneNumberId)
  }

  clear(phoneNumberId?: string): void {
    if (!phoneNumberId) {
      this.messages = []
    } else {
      this.messages = this.messages.filter((m) => m.phoneNumberId !== phoneNumberId)
    }
  }
}

export const messageStore = new MessageStore()
