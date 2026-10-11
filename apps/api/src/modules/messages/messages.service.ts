import type { Attachment, Message, MessageContentType, MessageStatus } from '@xatxoot/shared'
import { sql } from '../../db'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { ticketService } from '../tickets/tickets.service'
import {
  type DispatchedCloudRequest,
  type QueuedBaileysJob,
  messageStore,
  resetMessageStore,
  saveMessageToStore,
} from './message-store'

export type { DispatchedCloudRequest, QueuedBaileysJob }
export { resetMessageStore }

export interface AttachmentInputDto {
  fileType: string
  fileUrl: string
  fileName?: string | null
  fileSize?: number
  metadata?: Record<string, unknown>
}

export interface SendMessageInput {
  conversationId: string
  content?: string | null
  contentType?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'file' | string
  attachments?: AttachmentInputDto[]
  senderType?: 'user' | 'contact' | 'bot' | 'system'
  senderId?: string | null
  simulateError?: string | null
}

export class MessageService {
  getDispatchedCloudRequests(): DispatchedCloudRequest[] {
    return [...messageStore.dispatchedCloudRequests]
  }

  getQueuedBaileysJobs(): QueuedBaileysJob[] {
    return [...messageStore.queuedBaileysJobs]
  }

  async saveMessage(message: Message): Promise<Message> {
    saveMessageToStore(message)

    try {
      await sql`
        INSERT INTO messages (
          id, conversation_id, ticket_id, sender_type, sender_id, message_type,
          content, content_type, status, source_id, content_attributes, created_at, updated_at
        ) VALUES (
          ${message.id}, ${message.conversationId}, ${message.ticketId}, ${message.senderType},
          ${message.senderId}, ${message.messageType}, ${message.content}, ${message.contentType},
          ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)},
          ${message.createdAt}, ${message.updatedAt}
        )
      `
    } catch {
      // Memory fallback
    }

    return message
  }

  async getMessageById(id: string): Promise<Message | null> {
    const memory = messageStore.messages.get(id)
    if (memory) return memory

    try {
      const rows = await sql`
        SELECT
          id,
          conversation_id as "conversationId",
          ticket_id as "ticketId",
          sender_type as "senderType",
          sender_id as "senderId",
          message_type as "messageType",
          content,
          content_type as "contentType",
          status,
          source_id as "externalSourceId",
          content_attributes as "contentAttributes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM messages
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows.length > 0) {
        const msg = rows[0] as unknown as Message
        saveMessageToStore(msg)
        return msg
      }
    } catch {
      // Memory fallback
    }

    return null
  }

  async listConversationMessages(conversationId: string): Promise<Message[]> {
    const messageIds = messageStore.conversationIndex.get(conversationId) || []
    if (messageIds.length > 0) {
      return messageIds
        .map((id) => messageStore.messages.get(id))
        .filter((m): m is Message => m !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    try {
      const rows = await sql`
        SELECT
          id,
          conversation_id as "conversationId",
          ticket_id as "ticketId",
          sender_type as "senderType",
          sender_id as "senderId",
          message_type as "messageType",
          content,
          content_type as "contentType",
          status,
          source_id as "externalSourceId",
          content_attributes as "contentAttributes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `
      if (rows.length > 0) {
        return rows as unknown as Message[]
      }
    } catch {
      // Memory fallback
    }

    return []
  }

  async updateDeliveryStatus(externalId: string, status: MessageStatus): Promise<Message | null> {
    let targetMessage: Message | undefined
    for (const msg of messageStore.messages.values()) {
      if (msg.externalSourceId === externalId) {
        targetMessage = msg
        break
      }
    }

    if (!targetMessage) {
      try {
        const rows = await sql`
          SELECT
            id,
            conversation_id as "conversationId",
            ticket_id as "ticketId",
            sender_type as "senderType",
            sender_id as "senderId",
            message_type as "messageType",
            content,
            content_type as "contentType",
            status,
            source_id as "externalSourceId",
            content_attributes as "contentAttributes",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM messages
          WHERE source_id = ${externalId}
          LIMIT 1
        `
        if (rows.length > 0) {
          targetMessage = rows[0] as unknown as Message
        }
      } catch {
        // Memory fallback
      }
    }

    if (!targetMessage) {
      return null
    }

    const now = new Date().toISOString()
    const updated: Message = {
      ...targetMessage,
      status,
      updatedAt: now,
    }

    messageStore.messages.set(updated.id, updated)

    try {
      await sql`
        UPDATE messages
        SET status = ${status}, updated_at = ${now}
        WHERE source_id = ${externalId}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async dispatchWhatsAppCloud(params: {
    phoneNumberId: string
    to: string
    payload: Record<string, unknown>
    simulateError?: string | null
  }): Promise<{ externalId?: string; status: 'sent' | 'failed'; error?: unknown }> {
    if (params.simulateError === '24h_expired') {
      return {
        status: 'failed',
        error: {
          message:
            'Re-engagement message: More than 24 hours have passed since customer last replied.',
          type: 'OAuthException',
          code: 131047,
        },
      }
    }

    if (params.simulateError) {
      return {
        status: 'failed',
        error: {
          message: 'Message undeliverable',
          type: 'OAuthException',
          code: 131026,
        },
      }
    }

    const randomSuffix = Math.random().toString(36).substring(2, 9)
    const externalId = `wamid.out_${Date.now()}_${randomSuffix}`

    messageStore.dispatchedCloudRequests.push({
      phoneNumberId: params.phoneNumberId,
      to: params.to,
      payload: params.payload as DispatchedCloudRequest['payload'],
    })

    return {
      externalId,
      status: 'sent',
    }
  }

  async enqueueBaileysOutbound(params: QueuedBaileysJob['data']): Promise<{ jobId: string }> {
    const job: QueuedBaileysJob = {
      queue: 'wa-outbound',
      name: 'send-message',
      data: params,
    }

    messageStore.queuedBaileysJobs.push(job)
    return { jobId: params.jobId }
  }

  async sendMessage(input: SendMessageInput): Promise<{ message: Message }> {
    // 1. Check conversation existence
    const convDetail = await conversationService.getConversationById(input.conversationId)
    if (!convDetail) {
      throw new Error(`Conversation not found: ${input.conversationId}`)
    }

    const conversation = convDetail.conversation
    const contact = convDetail.contact
    const recipientNumber = contact?.phoneNumber || contact?.identifier || ''

    // 2. Validate content / attachments
    const hasContent = typeof input.content === 'string' && input.content.trim().length > 0
    const hasAttachments = Array.isArray(input.attachments) && input.attachments.length > 0

    if (!hasContent && !hasAttachments) {
      throw new Error('Content or attachment is required')
    }

    // 3. Resolve Inbox & Channel
    const inboxData = await inboxService.getInboxById(conversation.inboxId)
    const channelType = inboxData?.inbox.channelType || 'whatsapp_cloud'
    const channelId = inboxData?.inbox.channelId || crypto.randomUUID()
    const now = new Date().toISOString()
    const messageId = crypto.randomUUID()

    // Determine content type
    let contentType: MessageContentType = (input.contentType as MessageContentType) || 'text'
    if (!input.contentType && hasAttachments) {
      const firstAttachment = input.attachments?.[0]
      if (firstAttachment?.fileType.startsWith('image/')) contentType = 'image'
      else if (firstAttachment?.fileType.startsWith('video/')) contentType = 'video'
      else if (firstAttachment?.fileType.startsWith('audio/')) contentType = 'audio'
      else contentType = 'document'
    }

    // Attachments conversion
    const attachments: Attachment[] = (input.attachments || []).map((att) => ({
      id: crypto.randomUUID(),
      messageId,
      fileType: att.fileType,
      fileUrl: att.fileUrl,
      fileName: att.fileName || null,
      fileSize: att.fileSize || 0,
      thumbUrl: null,
      metadata: att.metadata || {},
      createdAt: now,
    }))

    let externalSourceId: string | null = null
    let status: MessageStatus = 'sent'
    const contentAttributes: Record<string, unknown> = {}

    // 4. Dispatch based on channel
    if (channelType === 'whatsapp_cloud') {
      const channel = inboxData?.channel as Record<string, unknown> | undefined
      const phoneNumberId = (channel?.phoneNumberId as string) || '1000000000'

      const metaPayload: Record<string, unknown> = {
        messaging_product: 'whatsapp',
        to: recipientNumber,
        type: contentType,
      }

      if (contentType === 'text') {
        metaPayload.text = { body: input.content?.trim() || '' }
      } else if (contentType === 'document') {
        const att = attachments[0]
        metaPayload.document = {
          link: att?.fileUrl,
          filename: att?.fileName,
          caption: input.content?.trim() || undefined,
        }
      } else if (contentType === 'image') {
        const att = attachments[0]
        metaPayload.image = {
          link: att?.fileUrl,
          caption: input.content?.trim() || undefined,
        }
      } else if (contentType === 'video') {
        const att = attachments[0]
        metaPayload.video = {
          link: att?.fileUrl,
          caption: input.content?.trim() || undefined,
        }
      } else if (contentType === 'audio') {
        const att = attachments[0]
        metaPayload.audio = {
          link: att?.fileUrl,
        }
      }

      const dispatchResult = await this.dispatchWhatsAppCloud({
        phoneNumberId,
        to: recipientNumber,
        payload: metaPayload,
        simulateError: input.simulateError,
      })

      if (dispatchResult.status === 'failed') {
        status = 'failed'
        contentAttributes.error = dispatchResult.error
      } else {
        externalSourceId = dispatchResult.externalId || null
      }
    } else if (channelType === 'whatsapp_unofficial') {
      const jobId = crypto.randomUUID()
      await this.enqueueBaileysOutbound({
        jobId,
        messageId,
        channelId,
        recipientNumber,
        messageType: contentType,
        text: input.content?.trim() || undefined,
        mediaUrl: attachments[0]?.fileUrl,
        fileName: attachments[0]?.fileName || undefined,
      })
    }

    // 5. Construct Message record
    const message: Message = {
      id: messageId,
      conversationId: conversation.id,
      ticketId: conversation.activeTicketId || null,
      senderType: input.senderType || 'user',
      senderId: input.senderId || 'mock-user-id',
      messageType: 'outgoing',
      content: input.content?.trim() || null,
      contentType,
      status,
      externalSourceId,
      contentAttributes,
      attachments,
      createdAt: now,
      updatedAt: now,
    }

    await this.saveMessage(message)

    // 6. Update Active Ticket first reply tracking if open
    if (conversation.activeTicketId) {
      await ticketService.recordFirstReply(conversation.activeTicketId)
    }

    return { message }
  }
}

export const messageService = new MessageService()
