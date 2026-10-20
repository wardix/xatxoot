import type { Attachment, Message, MessageContentType, MessageStatus } from '@xatxoot/shared'
import { sql } from '../../db'
import { conversationService } from '../conversations/conversations.service'
import { type WhatsAppUnofficialChannelData, inboxService } from '../inboxes/inboxes.service'
import { realtimeService } from '../realtime/realtime.service'
import { ticketService } from '../tickets/tickets.service'
import {
  type DispatchedCloudRequest,
  type QueuedBaileysJob,
  messageStore,
  resetMessageStore,
  saveMessageToStore,
} from './message-store'
import type { AttachmentInputDto, SendMessageInput } from './types'

export type { DispatchedCloudRequest, QueuedBaileysJob }
export type { AttachmentInputDto, SendMessageInput }
export { resetMessageStore }

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
      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val))

      const dbSenderId = isUuid(message.senderId)
        ? message.senderId
        : '3b87d597-cde4-4b3e-8cce-e3bd24ac1c4f'

      const dbTicketId = isUuid(message.ticketId) ? message.ticketId : null

      await sql`
        INSERT INTO messages (
          id, conversation_id, ticket_id, sender_type, sender_id, message_type,
          content, content_type, status, external_source_id, content_attributes, created_at, updated_at
        ) VALUES (
          ${message.id}, ${message.conversationId}, ${dbTicketId}, ${message.senderType},
          ${dbSenderId}, ${message.messageType}, ${message.content}, ${message.contentType},
          ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)},
          ${message.createdAt}, ${message.updatedAt}
        )
      `
    } catch (err) {
      console.warn('[messages.service] Could not save message to DB:', (err as Error).message)
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
          external_source_id as "externalSourceId",
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
          external_source_id as "externalSourceId",
          content_attributes as "contentAttributes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM messages
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `
      return (rows || []) as unknown as Message[]
    } catch {
      // Memory fallback if DB is offline
      const messageIds = messageStore.conversationIndex.get(conversationId) || []
      return messageIds
        .map((id) => messageStore.messages.get(id))
        .filter((m): m is Message => m !== undefined)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }
  }

  async getMessageByExternalId(externalId: string): Promise<Message | null> {
    if (!externalId) return null
    for (const msg of messageStore.messages.values()) {
      if (msg.externalSourceId === externalId) {
        return msg
      }
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
          external_source_id as "externalSourceId",
          content_attributes as "contentAttributes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM messages
        WHERE external_source_id = ${externalId}
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

  async updateDeliveryStatus(externalId: string, status: MessageStatus): Promise<Message | null> {
    const targetMessage = await this.getMessageByExternalId(externalId)
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
        WHERE external_source_id = ${externalId}
      `
    } catch {
      // Memory fallback
    }

    realtimeService.broadcast({
      event: 'message.status_updated',
      data: { message: updated },
    })

    return updated
  }

  async editMessage(params: {
    targetExternalId: string
    newContent: string
    editedAt?: string
  }): Promise<{ message: Message } | null> {
    const target = await this.getMessageByExternalId(params.targetExternalId)
    if (!target) return null

    const now = params.editedAt || new Date().toISOString()
    const attrs = (target.contentAttributes as Record<string, unknown>) || {}
    const editHistory = Array.isArray(attrs.editHistory) ? [...attrs.editHistory] : []
    editHistory.push({ previousContent: target.content || '', editedAt: now })

    const contentAttributes = { ...attrs, isEdited: true, editedAt: now, editHistory }
    const updated: Message = {
      ...target,
      content: params.newContent,
      contentAttributes,
      updatedAt: now,
    }

    messageStore.messages.set(updated.id, updated)
    try {
      await sql`
        UPDATE messages
        SET
          content = ${params.newContent},
          content_attributes = ${JSON.stringify(contentAttributes)},
          updated_at = ${now}
        WHERE id = ${updated.id}
      `
    } catch {
      // Memory fallback
    }

    realtimeService.broadcast({
      event: 'message.edited',
      data: {
        id: updated.id,
        conversationId: updated.conversationId,
        ticketId: updated.ticketId,
        content: updated.content,
        editedAt: now,
        contentAttributes,
        message: updated,
      },
    })

    return { message: updated }
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

    // Forward to wa-gateway HTTP endpoint asynchronously so caller is never blocked
    const gatewayPort = Number(process.env.PORT_GATEWAY || 8801)
    fetch(`http://127.0.0.1:${gatewayPort}/api/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10000),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; externalMessageId?: string }
          if (data?.externalMessageId && params.messageId) {
            try {
              await sql`
                UPDATE messages
                SET external_source_id = ${data.externalMessageId}
                WHERE id = ${params.messageId}
              `
            } catch {
              // fallback
            }
          }
        }
      })
      .catch((err) => {
        console.warn(
          '[api] Could not immediately forward message to wa-gateway:',
          (err as Error).message,
        )
      })

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
      const unofficialChannel = inboxData?.channel as WhatsAppUnofficialChannelData | undefined
      const jobId = crypto.randomUUID()
      await this.enqueueBaileysOutbound({
        jobId,
        messageId,
        channelId,
        sessionId: unofficialChannel?.sessionId,
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

    // 7. Mark conversation as read on agent reply
    await conversationService.markConversationAsRead(conversation.id)

    realtimeService.broadcast({
      event: 'message.created',
      data: { message, conversationId: conversation.id },
    })

    return { message }
  }
}

export const messageService = new MessageService()
