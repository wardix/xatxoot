import type { Context } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService } from '../messages/messages.service'

export interface WhatsAppUnofficialInboundBody {
  channelId?: string
  inboxId?: string
  senderNumber: string
  senderName?: string
  externalMessageId?: string
  messageType?: string
  content?: string
  mediaUrl?: string
  timestamp?: string
  isEcho?: boolean
  isEdit?: boolean
  targetExternalId?: string
  newContent?: string
  editedAt?: string
}

export async function handleWhatsAppUnofficialInbound(c: Context) {
  try {
    const body = (await c.req.json().catch(() => ({}))) as WhatsAppUnofficialInboundBody & {
      sessionId?: string
    }
    console.log(
      '[api-webhook] [DEBUG] Webhook received inbound message payload:',
      JSON.stringify(body),
    )

    if (!body || !body.senderNumber) {
      console.warn('[api-webhook] [DEBUG] Rejected: senderNumber is required')
      return c.json({ error: 'senderNumber is required' }, 400)
    }

    // Handle edited message
    if (body.isEdit) {
      const targetExternalId = body.targetExternalId || body.externalMessageId
      if (!targetExternalId) {
        return c.json({ error: 'targetExternalId is required for edited message' }, 400)
      }

      const result = await conversationService.handleEditedMessage({
        targetExternalId,
        newContent: body.newContent || body.content || '',
        editedAt: body.editedAt || body.timestamp,
      })

      if (!result) {
        console.warn(
          `[api-webhook] [DEBUG] Target message not found for targetExternalId=${targetExternalId}`,
        )
        return c.json({ error: 'Target message not found' }, 404)
      }

      console.log(
        `[api-webhook] [DEBUG] Inbound edited message updated successfully! messageId=${result.message.id}, conversationId=${result.message.conversationId}`,
      )

      return c.json({
        success: true,
        isEdit: true,
        messageId: result.message.id,
        conversationId: result.message.conversationId,
        ticketId: result.message.ticketId,
        message: result.message,
      })
    }

    // 0. Idempotency check on externalMessageId
    if (body.externalMessageId) {
      const existing = await messageService.getMessageByExternalId(body.externalMessageId)
      if (existing) {
        console.log(
          `[api-webhook] [DEBUG] Message with externalMessageId=${body.externalMessageId} already exists, skipping.`,
        )
        return c.json({
          success: true,
          skipped: true,
          isEcho: Boolean(body.isEcho),
          messageId: existing.id,
          conversationId: existing.conversationId,
          ticketId: existing.ticketId,
        })
      }
    }

    let inboxId = body.inboxId

    // 1. If inboxId is missing or default, resolve by sessionId if available
    if ((!inboxId || inboxId === 'default' || inboxId === 'active') && body.sessionId) {
      const inboxBySession = await inboxService.getInboxBySessionId(body.sessionId)
      if (inboxBySession) {
        inboxId = inboxBySession.inbox.id
      }
    }

    // 2. Fallback to default unofficial inbox if still unresolved
    if (!inboxId || inboxId === 'default' || inboxId === 'active') {
      const defaultInbox = await inboxService.getInboxById('default')
      if (defaultInbox) {
        inboxId = defaultInbox.inbox.id
      }
    }

    if (!inboxId) {
      console.warn('[api-webhook] [DEBUG] Rejected: Valid inboxId could not be resolved')
      return c.json({ error: 'Valid inboxId could not be resolved' }, 400)
    }

    const cleanSenderNumber = body.senderNumber.replace(/[^0-9]/g, '')
    const formattedPhone = cleanSenderNumber.startsWith('+')
      ? cleanSenderNumber
      : `+${cleanSenderNumber}`

    console.log(
      `[api-webhook] [DEBUG] Processing message for sender=${formattedPhone}, inboxId=${inboxId}`,
    )

    if (body.isEcho) {
      const result = await conversationService.handleOutboundEcho({
        inboxId,
        sourceId: cleanSenderNumber,
        senderPhone: formattedPhone,
        senderName: body.senderName || formattedPhone,
        content: body.content || '',
        externalId: body.externalMessageId || `wa_${Date.now()}`,
        messageType: body.messageType || 'text',
        mediaUrl: body.mediaUrl,
      })

      if (result.isDuplicate) {
        return c.json({
          success: true,
          skipped: true,
          isEcho: true,
          messageId: result.message.id,
          conversationId: result.conversation.id,
          ticketId: result.ticket?.id,
          contactId: result.contact.id,
        })
      }

      console.log(
        `[api-webhook] [DEBUG] Echo outgoing message processed successfully! conversationId=${result.conversation.id}, ticketId=${result.ticket?.id}, messageId=${result.message.id}`,
      )

      return c.json({
        success: true,
        isEcho: true,
        conversationId: result.conversation.id,
        ticketId: result.ticket?.id,
        messageId: result.message.id,
        contactId: result.contact.id,
      })
    }

    const result = await conversationService.handleInboundMessage({
      inboxId,
      sourceId: cleanSenderNumber,
      senderPhone: formattedPhone,
      senderName: body.senderName || formattedPhone,
      content: body.content || '',
      externalId: body.externalMessageId || `wa_${Date.now()}`,
      messageType: body.messageType || 'text',
      mediaUrl: body.mediaUrl,
    })

    console.log(
      `[api-webhook] [DEBUG] Inbound message processed successfully! conversationId=${result.conversation.id}, ticketId=${result.ticket.id}, messageId=${result.message.id}`,
    )

    return c.json({
      success: true,
      conversationId: result.conversation.id,
      ticketId: result.ticket.id,
      messageId: result.message.id,
      contactId: result.contact.id,
    })
  } catch (err) {
    console.error('[api-webhook] [DEBUG] Inbound error:', err)
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
