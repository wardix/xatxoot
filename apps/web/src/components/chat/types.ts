export type MessageType = 'incoming' | 'outgoing' | 'activity'

export type ContentType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'

export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'deleted_by_sender'

export interface QuotedMessagePayload {
  messageId: string
  externalId?: string | null
  senderName?: string
  snippet?: string
}

export interface MessageMention {
  jid: string
  phone?: string
  name?: string
  isMe?: boolean
}

export interface TimelineMessage {
  id: string
  conversationId: string
  ticketId?: string
  ticketDisplayId?: string
  senderId?: string
  senderType?: 'contact' | 'user' | 'bot' | 'system'
  senderName?: string
  replyTo?: QuotedMessagePayload | null
  messageType: MessageType
  contentType: ContentType
  content: string
  mediaUrl?: string
  fileName?: string
  fileSize?: number
  timestamp: string
  dateGroup?: string
  status?: DeliveryStatus
  errorMessage?: string
  isEcho?: boolean
  contentAttributes?: Record<string, unknown>
  isEdited?: boolean
  editedAt?: string
  editHistory?: Array<{
    previousContent: string
    editedAt: string
  }>
  isDeletedBySender?: boolean
  deletedAt?: string
  revokedOriginalContent?: string
  isGroup?: boolean
  participant?: string
  participantName?: string
  isForwarded?: boolean
  mentions?: MessageMention[]
  isMentioningMe?: boolean
  attachments?: Array<{
    id?: string
    fileUrl: string
    fileType?: string
    fileName?: string | null
    fileSize?: number | null
  }>
}
