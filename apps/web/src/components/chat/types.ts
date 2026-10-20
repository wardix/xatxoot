export type MessageType = 'incoming' | 'outgoing' | 'activity'

export type ContentType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export interface TimelineMessage {
  id: string
  conversationId: string
  ticketId?: string
  ticketDisplayId?: string
  senderId?: string
  senderType?: 'contact' | 'user' | 'bot' | 'system'
  senderName?: string
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
  isEdited?: boolean
  editedAt?: string
  editHistory?: Array<{
    previousContent: string
    editedAt: string
  }>
}
