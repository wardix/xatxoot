export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'

export interface MessageCreatedEvent {
  id: string
  conversationId: string
  ticketId?: string
  ticketDisplayId?: string
  content: string
  messageType: 'incoming' | 'outgoing' | 'activity' | string
  contentType: 'text' | 'image' | 'document' | 'audio' | 'video' | string
  senderId?: string
  senderType?: 'contact' | 'user' | 'system' | string
  senderName?: string
  timestamp?: string
  createdAt?: string
  status?: string
}

export interface MessageStatusUpdatedEvent {
  id: string
  conversationId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  updatedAt?: string
}

export interface MessageEditedEvent {
  id: string
  conversationId: string
  content: string
  editedAt: string
  contentAttributes?: {
    isEdited?: boolean
    editedAt?: string
    editHistory?: Array<{
      previousContent: string
      editedAt: string
    }>
    [key: string]: unknown
  }
}

export interface TicketUpdatedEvent {
  id: string
  ticketNumber: string
  status: 'open' | 'pending' | 'resolved' | 'snoozed'
  priority?: 'urgent' | 'high' | 'medium' | 'low'
  assignedTo?: string | null
  internalNote?: string | null
  updatedAt?: string
}

export type RealtimeEventHandler<T = unknown> = (data: T) => void

export interface RealtimeStreamOptions {
  baseUrl?: string
  token?: string
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onConnected?: (data: unknown) => void
  onMessageCreated?: (event: MessageCreatedEvent) => void
  onMessageStatusUpdated?: (event: MessageStatusUpdatedEvent) => void
  onMessageEdited?: (event: MessageEditedEvent) => void
  onTicketUpdated?: (event: TicketUpdatedEvent) => void
  onError?: (error: unknown) => void
  onStatusChange?: (status: RealtimeStatus) => void
}

export interface RealtimeStreamHookOptions extends RealtimeStreamOptions {
  enabled?: boolean
}
