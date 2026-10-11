import type { Message } from '@xatxoot/shared'

export interface DispatchedCloudRequest {
  phoneNumberId: string
  to: string
  payload: {
    messaging_product: string
    to: string
    type: string
    text?: { body: string }
    document?: { link: string; filename?: string; caption?: string }
    image?: { link: string; caption?: string }
    video?: { link: string; caption?: string }
    audio?: { link: string }
    [key: string]: unknown
  }
}

export interface QueuedBaileysJob {
  queue: string
  name: string
  data: {
    jobId: string
    messageId: string
    channelId: string
    recipientNumber: string
    messageType: string
    text?: string
    mediaUrl?: string
    fileName?: string
  }
}

export const messageStore = {
  messages: new Map<string, Message>(),
  conversationIndex: new Map<string, string[]>(), // conversationId -> messageId[]
  dispatchedCloudRequests: [] as DispatchedCloudRequest[],
  queuedBaileysJobs: [] as QueuedBaileysJob[],
}

export function resetMessageStore(): void {
  messageStore.messages.clear()
  messageStore.conversationIndex.clear()
  messageStore.dispatchedCloudRequests = []
  messageStore.queuedBaileysJobs = []
}

export function saveMessageToStore(message: Message): void {
  messageStore.messages.set(message.id, message)
  const currentList = messageStore.conversationIndex.get(message.conversationId) || []
  if (!currentList.includes(message.id)) {
    currentList.push(message.id)
    messageStore.conversationIndex.set(message.conversationId, currentList)
  }
}
