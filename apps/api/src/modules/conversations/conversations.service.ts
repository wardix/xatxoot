import type {
  Contact,
  ContactInbox,
  Conversation,
  Message,
  Ticket,
  TicketStatus,
} from '@xatxoot/shared'
import { sql } from '../../db'
import { assignmentService } from '../assignment/assignment.service'
import { messageStore, resetMessageStore, saveMessageToStore } from '../messages/message-store'
import { realtimeService } from '../realtime/realtime.service'
import { resetTicketStore, ticketService } from '../tickets/tickets.service'

export type { Contact, ContactInbox, Conversation, Message, Ticket, TicketStatus }

export function parseContentAttributes(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }
  return {}
}

export interface ConversationWithInbox extends Conversation {
  inboxName?: string | null
  channelType?: string | null
  channel?: string | null
}

export interface InboundMessagePayload {
  inboxId: string
  sourceId?: string
  senderPhone?: string | null
  senderNumber?: string | null
  senderName?: string | null
  content?: string | null
  messageType?: string
  externalId?: string | null
  contentType?: string
  mediaUrl?: string | null
  isGroup?: boolean
  groupJid?: string | null
  groupName?: string | null
  participant?: string | null
  participantName?: string | null
  isEcho?: boolean
  replyToExternalId?: string | null
  quotedText?: string | null
  quotedParticipant?: string | null
  mentions?: Array<{
    jid: string
    phone?: string
    name?: string
    isMe?: boolean
  }> | null
}

export interface InboundMessageResult {
  contact: Contact
  conversation: Conversation
  ticket: Ticket
  isNewTicket: boolean
  message: Message
}

export interface OutboundEchoPayload {
  inboxId: string
  sourceId: string
  senderPhone?: string | null
  senderName?: string | null
  content?: string | null
  messageType?: string
  externalId?: string | null
  contentType?: string
  mediaUrl?: string | null
  replyToExternalId?: string | null
  quotedText?: string | null
  quotedParticipant?: string | null
  mentions?: Array<{
    jid: string
    phone?: string
    name?: string
    isMe?: boolean
  }> | null
}

export interface OutboundEchoResult {
  contact: Contact
  conversation: Conversation
  ticket: Ticket | null
  message: Message
  isDuplicate?: boolean
}

export interface FindOrCreateContactDto {
  inboxId: string
  sourceId: string
  phone?: string | null
  name?: string | null
}

export interface ConversationDetail {
  conversation: Conversation
  contact: Contact | null
  activeTicket: Ticket | null
  messages: Message[]
}

const memoryStore = {
  contacts: new Map<string, Contact>(),
  contactInboxes: new Map<string, ContactInbox>(),
  conversations: new Map<string, Conversation>(),
  messages: new Map<string, Message[]>(),
}

export function resetConversationStore(): void {
  memoryStore.contacts.clear()
  memoryStore.contactInboxes.clear()
  memoryStore.conversations.clear()
  memoryStore.messages.clear()
  resetMessageStore()
  resetTicketStore()
}

export class ConversationService {
  private companyPhoneNumbers = new Set<string>()

  setCompanyPhoneNumbers(numbers: string[]): void {
    this.companyPhoneNumbers = new Set(numbers.map((n) => n.replace(/\D/g, '')))
  }

  isCompanyPhoneNumber(phone?: string | null): boolean {
    if (!phone) return false
    const clean = phone.replace(/\D/g, '')
    return this.companyPhoneNumbers.has(clean)
  }
  async findOrCreateContact(
    dto: FindOrCreateContactDto,
  ): Promise<{ contact: Contact; contactInbox: ContactInbox }> {
    const phone = dto.phone || dto.sourceId
    const now = new Date().toISOString()

    // 1. Check existing Contact in memory
    let contact = Array.from(memoryStore.contacts.values()).find(
      (c) =>
        (c.phoneNumber && c.phoneNumber === phone) ||
        (c.identifier && c.identifier === dto.sourceId) ||
        c.id === dto.sourceId,
    )

    // Check PostgreSQL DB if not found in memory
    if (!contact) {
      try {
        const rows = await sql`
          SELECT
            id,
            company_id as "companyId",
            name,
            phone_number as "phoneNumber",
            email,
            avatar_url as "avatarUrl",
            identifier,
            contact_type as "contactType",
            custom_attributes as "customAttributes",
            additional_attributes as "additionalAttributes",
            blocked,
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM contacts
          WHERE phone_number = ${phone} OR identifier = ${dto.sourceId}
          LIMIT 1
        `
        if (rows.length > 0) {
          contact = rows[0] as unknown as Contact
          memoryStore.contacts.set(contact.id, contact)
        }
      } catch {
        // Memory fallback
      }
    }

    if (contact) {
      const isPlaceholderName =
        !contact.name ||
        contact.name === 'Unknown' ||
        contact.name === contact.phoneNumber ||
        contact.name === contact.identifier ||
        contact.name === 'Nia' ||
        contact.name === 'Grup WhatsApp'

      if (
        dto.name &&
        isPlaceholderName &&
        dto.name !== contact.phoneNumber &&
        dto.name !== 'Unknown' &&
        dto.name !== 'Grup WhatsApp'
      ) {
        contact = {
          ...contact,
          name: dto.name,
          updatedAt: now,
        }
        memoryStore.contacts.set(contact.id, contact)

        try {
          await sql`
            UPDATE contacts
            SET name = ${dto.name}, updated_at = ${now}
            WHERE id = ${contact.id}
          `
        } catch {
          // Memory fallback
        }
      }
    } else {
      contact = {
        id: crypto.randomUUID(),
        companyId: null,
        name: dto.name || 'Unknown',
        phoneNumber: phone,
        email: null,
        avatarUrl: null,
        identifier: dto.sourceId,
        contactType: 'lead',
        customAttributes: {},
        additionalAttributes: {},
        blocked: false,
        createdAt: now,
        updatedAt: now,
      }
      memoryStore.contacts.set(contact.id, contact)

      try {
        await sql`
          INSERT INTO contacts (
            id, name, phone_number, identifier, contact_type, custom_attributes, additional_attributes, blocked, created_at, updated_at
          ) VALUES (
            ${contact.id}, ${contact.name}, ${contact.phoneNumber}, ${contact.identifier}, ${contact.contactType},
            ${JSON.stringify(contact.customAttributes)}, ${JSON.stringify(contact.additionalAttributes)},
            ${contact.blocked}, ${contact.createdAt}, ${contact.updatedAt}
          )
        `
      } catch {
        // Memory fallback
      }
    }

    // 2. Ensure ContactInbox mapping exists
    const contactInboxKey = `${contact.id}_${dto.inboxId}`
    let contactInbox = memoryStore.contactInboxes.get(contactInboxKey)

    if (!contactInbox) {
      try {
        const rows = await sql`
          SELECT
            id,
            contact_id as "contactId",
            inbox_id as "inboxId",
            source_id as "sourceId",
            hmac_verified as "hmacVerified",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM contact_inboxes
          WHERE contact_id = ${contact.id} AND inbox_id = ${dto.inboxId}
          LIMIT 1
        `
        if (rows.length > 0) {
          contactInbox = rows[0] as unknown as ContactInbox
          memoryStore.contactInboxes.set(contactInboxKey, contactInbox)
        }
      } catch {
        // Memory fallback
      }
    }

    if (!contactInbox) {
      contactInbox = {
        id: crypto.randomUUID(),
        contactId: contact.id,
        inboxId: dto.inboxId,
        sourceId: dto.sourceId,
        hmacVerified: false,
        createdAt: now,
        updatedAt: now,
      }
      memoryStore.contactInboxes.set(contactInboxKey, contactInbox)

      try {
        await sql`
          INSERT INTO contact_inboxes (
            id, contact_id, inbox_id, source_id, hmac_verified, created_at, updated_at
          ) VALUES (
            ${contactInbox.id}, ${contactInbox.contactId}, ${contactInbox.inboxId},
            ${contactInbox.sourceId}, ${contactInbox.hmacVerified},
            ${contactInbox.createdAt}, ${contactInbox.updatedAt}
          )
        `
      } catch {
        // Memory fallback
      }
    }

    return { contact, contactInbox }
  }

  async findMessageByExternalId(externalId: string): Promise<Message | null> {
    if (!externalId) return null
    const fromStore = Array.from(messageStore.messages.values()).find(
      (m) => m.externalSourceId === externalId,
    )
    if (fromStore) return fromStore

    try {
      const rows = await sql`
        SELECT id, conversation_id as "conversationId", ticket_id as "ticketId",
               sender_type as "senderType", sender_id as "senderId",
               message_type as "messageType", content, content_type as "contentType",
               status, external_source_id as "externalSourceId",
               content_attributes as "contentAttributes", created_at as "createdAt", updated_at as "updatedAt"
        FROM messages
        WHERE external_source_id = ${externalId}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        const msg = rows[0] as unknown as Message
        saveMessageToStore(msg)
        return msg
      }
    } catch {
      // Memory fallback
    }
    return null
  }

  async handleInboundMessage(payload: InboundMessagePayload): Promise<InboundMessageResult> {
    const now = new Date().toISOString()

    // 0. Idempotency Check: prevent duplicate messages and tickets when broadcasted to multiple inboxes
    if (payload.externalId) {
      let existingMsg = Array.from(messageStore.messages.values()).find(
        (m) => m.externalSourceId === payload.externalId,
      )

      if (!existingMsg) {
        try {
          const rows = await sql`
            SELECT id, conversation_id as "conversationId", ticket_id as "ticketId",
                   sender_type as "senderType", sender_id as "senderId",
                   message_type as "messageType", content, content_type as "contentType",
                   status, external_source_id as "externalSourceId",
                   content_attributes as "contentAttributes", created_at as "createdAt", updated_at as "updatedAt"
            FROM messages
            WHERE external_source_id = ${payload.externalId}
            LIMIT 1
          `
          if (rows && rows.length > 0) {
            existingMsg = rows[0] as unknown as Message
            saveMessageToStore(existingMsg)
          }
        } catch {
          // ignore
        }
      }

      if (existingMsg) {
        const conv =
          memoryStore.conversations.get(existingMsg.conversationId) ||
          ({ id: existingMsg.conversationId } as Conversation)

        const activeTkt = existingMsg.ticketId
          ? await ticketService.getTicketById(existingMsg.ticketId)
          : null

        const cnt =
          memoryStore.contacts.get(conv.contactId) ||
          ({ id: conv.contactId, name: payload.senderName || 'Kontak' } as Contact)

        return {
          contact: cnt,
          conversation: conv,
          ticket: activeTkt || ({} as Ticket),
          isNewTicket: false,
          message: existingMsg,
        }
      }
    }

    const isGroup = Boolean(
      payload.isGroup || payload.sourceId?.endsWith('@g.us') || payload.groupJid,
    )
    const groupJid =
      payload.groupJid || (payload.sourceId?.endsWith('@g.us') ? payload.sourceId : undefined)

    const effectivePhone =
      (isGroup && groupJid ? groupJid : payload.senderPhone) ||
      payload.senderNumber ||
      ((payload as Record<string, unknown>).senderNumber as string | undefined)
    const effectiveSourceId =
      (isGroup && groupJid ? groupJid : payload.sourceId) || effectivePhone || payload.inboxId

    // 1. Find or create Contact & ContactInbox
    const { contact, contactInbox } = await this.findOrCreateContact({
      inboxId: payload.inboxId,
      sourceId: effectiveSourceId,
      phone: effectivePhone,
      name: payload.senderName || (isGroup ? 'Grup WhatsApp' : undefined),
    })

    // 2. Find or create persistent Conversation thread (Unified group architecture)
    let conversation: Conversation | undefined
    if (isGroup && groupJid) {
      conversation = Array.from(memoryStore.conversations.values()).find(
        (c) =>
          c.contactId === contact.id ||
          (c.customAttributes as Record<string, unknown>)?.groupJid === groupJid,
      )

      if (!conversation) {
        try {
          const rows = await sql`
            SELECT id, inbox_id as "inboxId", contact_id as "contactId",
                   contact_inbox_id as "contactInboxId", active_ticket_id as "activeTicketId",
                   unread_count as "unreadCount", last_message_at as "lastMessageAt",
                   custom_attributes as "customAttributes",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM conversations
            WHERE contact_id = ${contact.id} OR custom_attributes->>'groupJid' = ${groupJid}
            LIMIT 1
          `
          if (rows && rows.length > 0) {
            conversation = rows[0] as unknown as Conversation
            memoryStore.conversations.set(conversation.id, conversation)
          }
        } catch {
          // ignore
        }
      }
    }

    if (!conversation) {
      conversation = Array.from(memoryStore.conversations.values()).find(
        (c) => c.inboxId === payload.inboxId && c.contactId === contact.id,
      )
    }

    if (!conversation) {
      try {
        const rows = await sql`
          SELECT
            id,
            inbox_id as "inboxId",
            contact_id as "contactId",
            contact_inbox_id as "contactInboxId",
            active_ticket_id as "activeTicketId",
            unread_count as "unreadCount",
            last_message_at as "lastMessageAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM conversations
          WHERE inbox_id = ${payload.inboxId} AND contact_id = ${contact.id}
          LIMIT 1
        `
        if (rows.length > 0) {
          conversation = rows[0] as unknown as Conversation
          memoryStore.conversations.set(conversation.id, conversation)
        }
      } catch {
        // Memory fallback
      }
    }

    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
        inboxId: payload.inboxId,
        contactId: contact.id,
        contactInboxId: contactInbox.id,
        activeTicketId: null,
        unreadCount: 0,
        lastMessageAt: now,
        customAttributes: isGroup && groupJid ? { isGroup: true, groupJid } : {},
        createdAt: now,
        updatedAt: now,
      } as unknown as Conversation
      memoryStore.conversations.set(conversation.id, conversation)

      try {
        await sql`
          INSERT INTO conversations (
            id, inbox_id, contact_id, contact_inbox_id, active_ticket_id, unread_count, last_message_at, created_at, updated_at
          ) VALUES (
            ${conversation.id}, ${conversation.inboxId}, ${conversation.contactId}, ${conversation.contactInboxId},
            ${conversation.activeTicketId}, ${conversation.unreadCount}, ${conversation.lastMessageAt},
            ${conversation.createdAt}, ${conversation.updatedAt}
          )
        `
      } catch {
        // Memory fallback
      }
    }

    // 3. Ticket FSM Lifecycle automation & Internal Participant Check
    const isInternal = Boolean(
      payload.isEcho || (payload.participant && this.isCompanyPhoneNumber(payload.participant)),
    )

    let ticket: Ticket
    let isNewTicket = false

    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

    if (isInternal) {
      ticket = activeTicket || ({} as Ticket)
      isNewTicket = false

      conversation = {
        ...conversation,
        lastMessageAt: now,
        updatedAt: now,
      }
      memoryStore.conversations.set(conversation.id, conversation)

      try {
        await sql`
          UPDATE conversations
          SET
            last_message_at = ${now},
            updated_at = ${now}
          WHERE id = ${conversation.id}
        `
      } catch {
        // Memory fallback
      }
    } else {
      if (!activeTicket || activeTicket.status === 'resolved') {
        // Create a brand new ticket with status 'open'
        ticket = await ticketService.createTicket({
          conversationId: conversation.id,
          status: 'open',
          priority: 'medium',
        })
        isNewTicket = true

        try {
          const assignResult = await assignmentService.assignTicketRoundRobin(ticket.id, {
            inboxId: conversation.inboxId,
          })
          if (assignResult.success && assignResult.assignedAgentId) {
            ticket = assignResult.ticket
          }
        } catch {
          // Fallback gracefully
        }
      } else if (activeTicket.status === 'pending' || activeTicket.status === 'snoozed') {
        // Customer replied: automatically reopen ticket back to 'open'
        ticket = await ticketService.updateTicketStatus(activeTicket.id, 'open')
        isNewTicket = false
      } else {
        // Active ticket is already 'open'
        ticket = activeTicket
        isNewTicket = false
      }

      // Update conversation state
      conversation = {
        ...conversation,
        activeTicketId: ticket.id,
        unreadCount: (conversation.unreadCount || 0) + 1,
        lastMessageAt: now,
        updatedAt: now,
      }
      memoryStore.conversations.set(conversation.id, conversation)

      try {
        await sql`
          UPDATE conversations
          SET
            active_ticket_id = ${ticket.id},
            unread_count = ${conversation.unreadCount},
            last_message_at = ${now},
            updated_at = ${now}
          WHERE id = ${conversation.id}
        `
      } catch {
        // Memory fallback
      }
    }

    // 4. Create Message record
    const convMessages = memoryStore.messages.get(conversation.id) || []
    memoryStore.messages.set(conversation.id, convMessages)

    // Resolve Quoted Reply context if replyToExternalId is provided (Issue #301)
    let replyTo:
      | {
          messageId: string
          externalId?: string | null
          senderName?: string
          snippet?: string
        }
      | undefined

    if (payload.replyToExternalId) {
      try {
        const targetMsg = await this.findMessageByExternalId(payload.replyToExternalId)
        if (targetMsg) {
          const targetAttrs = parseContentAttributes(targetMsg.contentAttributes)
          let targetSenderName =
            targetMsg.senderName ||
            (targetAttrs.senderName as string | undefined) ||
            (targetAttrs.participantName as string | undefined)
          if (!targetSenderName) {
            if (targetMsg.senderType === 'user') {
              targetSenderName = 'Petugas CS'
            } else if (targetMsg.senderType === 'contact') {
              targetSenderName = 'Pelanggan'
            } else {
              targetSenderName = 'Bot Otomasi'
            }
          }
          const snippet = (
            targetMsg.content ||
            (targetMsg.contentType === 'image' || targetAttrs.contentType === 'image'
              ? '[Gambar]'
              : '') ||
            payload.quotedText ||
            ''
          ).slice(0, 100)

          replyTo = {
            messageId: targetMsg.id,
            externalId: targetMsg.externalSourceId || payload.replyToExternalId,
            senderName: targetSenderName,
            snippet,
          }
        } else {
          let fallbackSenderName = 'Kutipan'
          if (payload.quotedParticipant) {
            const rawPart = payload.quotedParticipant
              .replace(/@s\.whatsapp\.net$/, '')
              .replace(/@c\.us$/, '')
              .replace(/:.*$/, '')
            fallbackSenderName = rawPart.startsWith('+') ? rawPart : `+${rawPart}`
          }
          replyTo = {
            messageId: payload.replyToExternalId,
            externalId: payload.replyToExternalId,
            senderName: fallbackSenderName,
            snippet: (payload.quotedText || '').slice(0, 100),
          }
        }
      } catch {
        replyTo = {
          messageId: payload.replyToExternalId,
          externalId: payload.replyToExternalId,
          senderName: 'Kutipan',
          snippet: (payload.quotedText || '').slice(0, 100),
        }
      }
    }

    const customerSenderName = contact.name || payload.senderName || 'Pelanggan'
    const finalSenderName = isInternal
      ? payload.participantName || payload.senderName || 'Internal'
      : payload.participantName || customerSenderName
    const finalContentType =
      payload.contentType || (payload.messageType === 'image' ? 'image' : undefined) || 'text'

    // Resolve mentions and evaluate isMentioningMe (Issue #301)
    let isMentioningMe = false
    let finalMentions = payload.mentions ? [...payload.mentions] : undefined

    if (finalMentions && finalMentions.length > 0) {
      finalMentions = finalMentions.map((m) => {
        const cleanPhone = m.phone
          ? m.phone.replace(/\D/g, '')
          : m.jid.split('@')[0].replace(/\D/g, '')
        const isMe = Boolean(m.isMe || (cleanPhone && this.isCompanyPhoneNumber(cleanPhone)))
        if (isMe) {
          isMentioningMe = true
        }
        return {
          ...m,
          isMe: isMe || undefined,
        }
      })
    }

    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      ticketId: ticket.id || null,
      senderType: isInternal ? 'user' : 'contact',
      senderId: isInternal ? null : contact.id,
      senderName: finalSenderName,
      messageType: isInternal
        ? 'outgoing'
        : (payload.messageType as unknown as Message['messageType']) || 'incoming',
      content: payload.content ?? null,
      contentType: finalContentType as unknown as Message['contentType'],
      status: isInternal ? 'sent' : 'delivered',
      externalSourceId: payload.externalId ?? null,
      replyTo: replyTo || undefined,
      mentions: finalMentions,
      isMentioningMe: isMentioningMe || undefined,
      contentAttributes: {
        isGroup: isGroup ? true : undefined,
        groupJid,
        participant: payload.participant || undefined,
        participantName: payload.participantName || undefined,
        senderName: finalSenderName,
        mediaUrl: payload.mediaUrl || undefined,
        isEcho: isInternal ? true : undefined,
        ...(replyTo ? { replyTo } : {}),
        mentions: finalMentions,
        isMentioningMe: isMentioningMe || undefined,
      },
      attachments: payload.mediaUrl
        ? [
            {
              id: crypto.randomUUID(),
              messageId: '',
              fileType: payload.messageType === 'image' ? 'image/jpeg' : 'application/octet-stream',
              fileUrl: payload.mediaUrl,
              fileName: payload.mediaUrl.split('/').pop() || null,
              fileSize: null,
              createdAt: now,
            },
          ]
        : [],
      createdAt: now,
      updatedAt: now,
    }
    if (message.attachments[0]) {
      message.attachments[0].messageId = message.id
    }

    convMessages.push(message)
    memoryStore.messages.set(conversation.id, convMessages)
    saveMessageToStore(message)

    try {
      await sql`
        INSERT INTO messages (
          id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
          status, external_source_id, content_attributes, created_at, updated_at
        ) VALUES (
          ${message.id}, ${message.conversationId}, ${message.ticketId}, ${message.senderType},
          ${message.senderId}, ${message.messageType}, ${message.content}, ${message.contentType},
          ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)},
          ${message.createdAt}, ${message.updatedAt}
        )
      `

      if (payload.mediaUrl) {
        await sql`
          INSERT INTO attachments (
            id, message_id, file_type, file_url, file_size, file_name, created_at
          ) VALUES (
            ${message.attachments[0].id}, ${message.id}, ${message.attachments[0].fileType},
            ${payload.mediaUrl}, null, ${message.attachments[0].fileName}, ${now}
          )
        `
      }
    } catch {
      // Memory fallback
    }

    const result = {
      contact,
      conversation,
      ticket,
      isNewTicket,
      message,
    }

    realtimeService.broadcast({
      event: 'message.created',
      data: {
        id: message.id,
        conversationId: conversation.id,
        content: message.content || '',
        messageType: message.messageType,
        contentType: message.contentType,
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: contact.name || 'Pelanggan WhatsApp',
        replyTo: message.replyTo,
        contentAttributes: message.contentAttributes,
        timestamp: message.createdAt,
        createdAt: message.createdAt,
        message,
        conversation,
        contact,
        ticket,
        isNewTicket,
      },
    })

    return result
  }

  async handleOutboundEcho(payload: OutboundEchoPayload): Promise<OutboundEchoResult> {
    const now = new Date().toISOString()

    // 1. Idempotency Check: check if message with externalId already exists
    if (payload.externalId) {
      for (const msg of messageStore.messages.values()) {
        if (msg.externalSourceId === payload.externalId) {
          const conv = await this.getConversationById(msg.conversationId)
          if (conv?.contact) {
            return {
              contact: conv.contact,
              conversation: conv.conversation,
              ticket: conv.activeTicket,
              message: msg,
              isDuplicate: true,
            }
          }
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
          WHERE external_source_id = ${payload.externalId}
          LIMIT 1
        `
        if (rows.length > 0) {
          const existingMsg = rows[0] as unknown as Message
          saveMessageToStore(existingMsg)
          const conv = await this.getConversationById(existingMsg.conversationId)
          if (conv?.contact) {
            return {
              contact: conv.contact,
              conversation: conv.conversation,
              ticket: conv.activeTicket,
              message: existingMsg,
              isDuplicate: true,
            }
          }
        }
      } catch {
        // Fallback
      }
    }

    // 2. Find or create Contact & ContactInbox for customer
    const formattedPhone = payload.senderPhone || payload.sourceId
    const customerName =
      payload.senderName && payload.senderName !== 'Nia' && payload.senderName !== formattedPhone
        ? payload.senderName
        : formattedPhone

    const { contact, contactInbox } = await this.findOrCreateContact({
      inboxId: payload.inboxId,
      sourceId: payload.sourceId,
      phone: payload.senderPhone,
      name: customerName,
    })

    // 3. Find or create persistent Conversation thread
    let conversation = Array.from(memoryStore.conversations.values()).find(
      (c) => c.inboxId === payload.inboxId && c.contactId === contact.id,
    )

    if (!conversation) {
      try {
        const rows = await sql`
          SELECT
            id,
            inbox_id as "inboxId",
            contact_id as "contactId",
            contact_inbox_id as "contactInboxId",
            active_ticket_id as "activeTicketId",
            unread_count as "unreadCount",
            last_message_at as "lastMessageAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM conversations
          WHERE inbox_id = ${payload.inboxId} AND contact_id = ${contact.id}
          LIMIT 1
        `
        if (rows.length > 0) {
          conversation = rows[0] as unknown as Conversation
          memoryStore.conversations.set(conversation.id, conversation)
        }
      } catch {
        // Memory fallback
      }
    }

    if (!conversation) {
      conversation = {
        id: crypto.randomUUID(),
        inboxId: payload.inboxId,
        contactId: contact.id,
        contactInboxId: contactInbox.id,
        activeTicketId: null,
        unreadCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      }
      memoryStore.conversations.set(conversation.id, conversation)

      try {
        await sql`
          INSERT INTO conversations (
            id, inbox_id, contact_id, contact_inbox_id, active_ticket_id, unread_count, last_message_at, created_at, updated_at
          ) VALUES (
            ${conversation.id}, ${conversation.inboxId}, ${conversation.contactId}, ${conversation.contactInboxId},
            ${conversation.activeTicketId}, ${conversation.unreadCount}, ${conversation.lastMessageAt},
            ${conversation.createdAt}, ${conversation.updatedAt}
          )
        `
      } catch {
        // Memory fallback
      }
    }

    // 4. Ticket handling:
    // Outgoing messages from agent/staff DO NOT create a new ticket.
    // They only attach to an existing active ticket if one is already in progress.
    let ticket: Ticket | null = null
    if (conversation.activeTicketId) {
      ticket = await ticketService.getTicketById(conversation.activeTicketId)
      if (ticket && ticket.status === 'resolved') {
        ticket = null
      }
    }

    if (ticket) {
      await ticketService.recordFirstReply(ticket.id)
    }

    const activeTicketId = ticket ? ticket.id : null

    // Update conversation (agent replied -> unreadCount remains 0)
    conversation = {
      ...conversation,
      activeTicketId,
      unreadCount: 0,
      lastMessageAt: now,
      updatedAt: now,
    }
    memoryStore.conversations.set(conversation.id, conversation)

    try {
      await sql`
        UPDATE conversations
        SET
          active_ticket_id = ${activeTicketId},
          unread_count = 0,
          last_message_at = ${now},
          updated_at = ${now}
        WHERE id = ${conversation.id}
      `
    } catch {
      // Memory fallback
    }

    // 5. Create Outgoing Message
    const convMessages = memoryStore.messages.get(conversation.id) || []

    let echoReplyTo:
      | {
          messageId: string
          externalId?: string | null
          senderName?: string
          snippet?: string
        }
      | undefined

    if (payload.replyToExternalId) {
      try {
        const targetMsg = await this.findMessageByExternalId(payload.replyToExternalId)
        if (targetMsg) {
          const targetAttrs = parseContentAttributes(targetMsg.contentAttributes)
          let targetSenderName =
            targetMsg.senderName ||
            (targetAttrs.senderName as string | undefined) ||
            (targetAttrs.participantName as string | undefined)
          if (!targetSenderName) {
            targetSenderName = targetMsg.senderType === 'user' ? 'Petugas CS' : 'Pelanggan'
          }
          const snippet = (
            targetMsg.content ||
            (targetMsg.contentType === 'image' || targetAttrs.contentType === 'image'
              ? '[Gambar]'
              : '') ||
            payload.quotedText ||
            ''
          ).slice(0, 100)

          echoReplyTo = {
            messageId: targetMsg.id,
            externalId: targetMsg.externalSourceId || payload.replyToExternalId,
            senderName: targetSenderName,
            snippet,
          }
        } else {
          let fallbackSenderName = 'Kutipan'
          if (payload.quotedParticipant) {
            const rawPart = payload.quotedParticipant
              .replace(/@s\.whatsapp\.net$/, '')
              .replace(/@c\.us$/, '')
              .replace(/:.*$/, '')
            fallbackSenderName = rawPart.startsWith('+') ? rawPart : `+${rawPart}`
          }
          echoReplyTo = {
            messageId: payload.replyToExternalId,
            externalId: payload.replyToExternalId,
            senderName: fallbackSenderName,
            snippet: (payload.quotedText || '').slice(0, 100),
          }
        }
      } catch {
        echoReplyTo = {
          messageId: payload.replyToExternalId,
          externalId: payload.replyToExternalId,
          senderName: 'Kutipan',
          snippet: (payload.quotedText || '').slice(0, 100),
        }
      }
    }

    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      ticketId: activeTicketId,
      senderType: 'user',
      senderId: null,
      senderName: 'WhatsApp HP',
      isEcho: true,
      messageType: 'outgoing',
      content: payload.content ?? null,
      contentType: (payload.contentType as unknown as Message['contentType']) || 'text',
      status: 'sent',
      externalSourceId: payload.externalId ?? null,
      replyTo: echoReplyTo || undefined,
      mediaUrl: payload.mediaUrl || undefined,
      contentAttributes: {
        echo: true,
        source: 'whatsapp_mobile',
        senderName: 'WhatsApp HP',
        mediaUrl: payload.mediaUrl || undefined,
        ...(echoReplyTo ? { replyTo: echoReplyTo } : {}),
      },
      attachments: payload.mediaUrl
        ? [
            {
              id: crypto.randomUUID(),
              messageId: '',
              fileType:
                payload.contentType === 'image'
                  ? 'image/jpeg'
                  : payload.contentType === 'document'
                    ? 'application/pdf'
                    : 'application/octet-stream',
              fileUrl: payload.mediaUrl,
              fileName: payload.mediaUrl.split('/').pop() || null,
              fileSize: null,
              createdAt: now,
            },
          ]
        : [],
      createdAt: now,
      updatedAt: now,
    }
    if (message.attachments[0]) {
      message.attachments[0].messageId = message.id
    }

    convMessages.push(message)
    memoryStore.messages.set(conversation.id, convMessages)
    saveMessageToStore(message)

    try {
      await sql`
        INSERT INTO messages (
          id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
          status, external_source_id, content_attributes, created_at, updated_at
        ) VALUES (
          ${message.id}, ${message.conversationId}, ${message.ticketId}, ${message.senderType},
          ${null}, ${message.messageType}, ${message.content}, ${message.contentType},
          ${message.status}, ${message.externalSourceId}, ${JSON.stringify(message.contentAttributes)},
          ${message.createdAt}, ${message.updatedAt}
        )
      `

      if (payload.mediaUrl && message.attachments[0]) {
        await sql`
          INSERT INTO attachments (
            id, message_id, file_type, file_url, file_size, file_name, created_at
          ) VALUES (
            ${message.attachments[0].id}, ${message.id}, ${message.attachments[0].fileType},
            ${payload.mediaUrl}, null, ${message.attachments[0].fileName}, ${now}
          )
        `
      }
    } catch {
      // Memory fallback
    }

    const result = {
      contact,
      conversation,
      ticket,
      message,
    }

    realtimeService.broadcast({
      event: 'message.created',
      data: {
        id: message.id,
        conversationId: conversation.id,
        content: message.content || '',
        messageType: message.messageType,
        contentType: message.contentType,
        mediaUrl: payload.mediaUrl || undefined,
        attachments: message.attachments,
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: 'WhatsApp HP',
        isEcho: true,
        replyTo: message.replyTo,
        contentAttributes: message.contentAttributes,
        timestamp: message.createdAt,
        createdAt: message.createdAt,
        message,
        conversation,
        contact,
        ticket,
      },
    })

    return result
  }

  async getConversationById(id: string): Promise<ConversationDetail | null> {
    let conversation: Conversation | null = null

    try {
      const rows = await sql`
        SELECT
          c.id,
          c.inbox_id as "inboxId",
          c.contact_id as "contactId",
          c.contact_inbox_id as "contactInboxId",
          c.active_ticket_id as "activeTicketId",
          c.unread_count as "unreadCount",
          c.last_message_at as "lastMessageAt",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          i.name as "inboxName",
          i.channel_type as "channelType"
        FROM conversations c
        LEFT JOIN inboxes i ON c.inbox_id = i.id
        WHERE c.id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        const row = rows[0] as unknown as ConversationWithInbox
        conversation = {
          ...row,
          channel: row.channel || row.channelType || 'whatsapp',
        }
        memoryStore.conversations.set(id, conversation)
      } else {
        memoryStore.conversations.delete(id)
        return null
      }
    } catch {
      // Memory fallback if DB is offline
      conversation = memoryStore.conversations.get(id) || null
    }

    if (!conversation) {
      return null
    }

    const currentConv = conversation as ConversationWithInbox
    if ((!currentConv.inboxName || !currentConv.channelType) && currentConv.inboxId) {
      try {
        const { inboxService } = await import('../inboxes/inboxes.service')
        const res = await inboxService.getInboxById(currentConv.inboxId)
        if (res?.inbox) {
          conversation = {
            ...currentConv,
            inboxName: currentConv.inboxName || res.inbox.name,
            channelType: currentConv.channelType || res.inbox.channelType,
            channel: currentConv.channel || currentConv.channelType || res.inbox.channelType,
          }
        }
      } catch {
        // ignore
      }
    }

    let contact: Contact | null = null
    if (conversation.contactId) {
      try {
        const cRows = await sql`
          SELECT id, name, phone_number as "phoneNumber", email, avatar_url as "avatarUrl",
                 created_at as "createdAt", updated_at as "updatedAt"
          FROM contacts WHERE id = ${conversation.contactId} LIMIT 1
        `
        if (cRows && cRows.length > 0) {
          contact = cRows[0] as unknown as Contact
          memoryStore.contacts.set(conversation.contactId, contact)
        }
      } catch {
        contact = memoryStore.contacts.get(conversation.contactId) || null
      }
    }

    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

    let messages: Message[] = []
    try {
      const dbMsgs = await sql`
        SELECT m.id, m.conversation_id as "conversationId", m.ticket_id as "ticketId",
               t.display_id as "ticketDisplayId",
               m.sender_id as "senderId", m.sender_type as "senderType",
               COALESCE(u.display_name, m.content_attributes->>'senderName', CASE WHEN m.sender_type = 'bot' THEN 'Bot Otomasi' ELSE NULL END) as "senderName",
               u.email as "senderEmail",
               m.message_type as "messageType", m.content_type as "contentType",
               m.content, m.status, m.external_source_id as "externalSourceId",
               m.content_attributes as "contentAttributes",
               m.created_at as "createdAt", m.updated_at as "updatedAt"
        FROM messages m
        LEFT JOIN tickets t ON m.ticket_id = t.id
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ${id}
        ORDER BY m.created_at ASC
      `
      if (dbMsgs && dbMsgs.length > 0) {
        messages = dbMsgs as unknown as Message[]
      }
    } catch {
      // Memory fallback if DB is offline
    }

    if (messages.length === 0) {
      const storeIds = messageStore.conversationIndex.get(conversation.id) || []
      const storeMessages = storeIds
        .map((id) => messageStore.messages.get(id))
        .filter((m): m is Message => m !== undefined)
      messages =
        storeMessages.length > 0 ? storeMessages : memoryStore.messages.get(conversation.id) || []
    }

    const convRecord = conversation as Record<string, unknown>
    const contactRecord = contact as Record<string, unknown> | null
    const isGroup = Boolean(
      convRecord.isGroup ||
        (conversation.customAttributes as Record<string, unknown>)?.isGroup ||
        contact?.phoneNumber?.includes('@g.us') ||
        contact?.phoneNumber?.includes('120363') ||
        contact?.identifier?.includes('@g.us') ||
        contact?.identifier?.includes('120363') ||
        contactRecord?.contactType === 'group',
    )
    const groupJid =
      (convRecord.groupJid as string | undefined) ||
      (conversation.customAttributes as Record<string, unknown>)?.groupJid ||
      (contact?.phoneNumber?.includes('@g.us') ? contact.phoneNumber : undefined) ||
      (contact?.identifier?.includes('@g.us') ? contact.identifier : undefined) ||
      (isGroup && contact?.phoneNumber
        ? contact.phoneNumber.includes('@g.us')
          ? contact.phoneNumber
          : `${contact.phoneNumber.replace(/[^0-9]/g, '')}@g.us`
        : undefined)

    if (isGroup) {
      conversation = {
        ...conversation,
        isGroup: true,
        groupJid,
      } as Conversation
    }

    messages = messages.map((m) => {
      const attrs = parseContentAttributes(m.contentAttributes)
      let senderName = m.senderName || (attrs.senderName as string | undefined)
      if (!senderName && m.senderType === 'bot') {
        senderName = 'Bot Otomasi'
      }
      const mediaUrl =
        m.mediaUrl ||
        (attrs.mediaUrl as string | undefined) ||
        (Array.isArray(m.attachments) && m.attachments[0]?.fileUrl) ||
        undefined
      const contentType =
        (m.contentType && m.contentType !== 'text' ? m.contentType : undefined) ||
        (m.messageType === 'image' ? 'image' : undefined) ||
        (attrs.contentType as string | undefined) ||
        m.contentType ||
        'text'

      return {
        ...m,
        senderName,
        contentType,
        mediaUrl,
        replyTo: (attrs.replyTo as Message['replyTo']) || m.replyTo || null,
        contentAttributes: attrs,
        isGroup: Boolean(m.isGroup || attrs.isGroup || isGroup),
        groupJid: m.groupJid || (attrs.groupJid as string | undefined) || groupJid,
        participant: m.participant || (attrs.participant as string | undefined),
        participantName: m.participantName || (attrs.participantName as string | undefined),
        isEcho: Boolean(m.isEcho || attrs.echo || attrs.source === 'whatsapp_mobile'),
        mentions: (attrs.mentions as Message['mentions']) || m.mentions,
        isMentioningMe: Boolean(attrs.isMentioningMe ?? m.isMentioningMe),
      }
    })

    if (conversation.unreadCount && conversation.unreadCount > 0) {
      conversation.unreadCount = 0
      this.markConversationAsRead(id).catch(() => {})
    }

    return {
      conversation,
      contact,
      activeTicket,
      messages,
    }
  }

  async markConversationAsRead(id: string): Promise<boolean> {
    const conv = memoryStore.conversations.get(id)
    if (conv) {
      conv.unreadCount = 0
      conv.updatedAt = new Date().toISOString()
    }

    try {
      await sql`
        UPDATE conversations
        SET unread_count = 0, updated_at = NOW()
        WHERE id = ${id}
      `
      return true
    } catch {
      return Boolean(conv)
    }
  }

  async listConversations(filter?: { inboxId?: string }): Promise<
    Array<
      Conversation & {
        contact: Contact | null
        activeTicket: Ticket | null
        inboxName?: string | null
        channelType?: string | null
        channel?: string | null
        lastMessage?: string | null
      }
    >
  > {
    let conversations: Conversation[]

    try {
      const rows = filter?.inboxId
        ? await sql`
            SELECT c.id, c.inbox_id as "inboxId", c.contact_id as "contactId",
                   c.contact_inbox_id as "contactInboxId", c.active_ticket_id as "activeTicketId",
                   c.unread_count as "unreadCount", c.last_message_at as "lastMessageAt",
                   c.created_at as "createdAt", c.updated_at as "updatedAt",
                   i.name as "inboxName", i.channel_type as "channelType"
            FROM conversations c
            LEFT JOIN inboxes i ON c.inbox_id = i.id
            WHERE c.inbox_id = ${filter.inboxId}
            ORDER BY c.last_message_at DESC
          `
        : await sql`
            SELECT c.id, c.inbox_id as "inboxId", c.contact_id as "contactId",
                   c.contact_inbox_id as "contactInboxId", c.active_ticket_id as "activeTicketId",
                   c.unread_count as "unreadCount", c.last_message_at as "lastMessageAt",
                   c.created_at as "createdAt", c.updated_at as "updatedAt",
                   i.name as "inboxName", i.channel_type as "channelType"
            FROM conversations c
            LEFT JOIN inboxes i ON c.inbox_id = i.id
            ORDER BY c.last_message_at DESC
          `
      conversations = (rows || []) as unknown as Conversation[]
      if (!filter?.inboxId) {
        memoryStore.conversations.clear()
        for (const conv of conversations) {
          memoryStore.conversations.set(conv.id, conv)
        }
      }
    } catch {
      // Memory fallback if DB is offline
      conversations = Array.from(memoryStore.conversations.values())
      if (filter?.inboxId) {
        conversations = conversations.filter((c) => c.inboxId === filter.inboxId)
      }
    }

    const { inboxService } = await import('../inboxes/inboxes.service')

    const result = []
    for (const conv of conversations) {
      const convWithInbox = conv as ConversationWithInbox
      let inboxName = convWithInbox.inboxName
      let channelType = convWithInbox.channelType || convWithInbox.channel
      if ((!inboxName || !channelType) && conv.inboxId) {
        try {
          const res = await inboxService.getInboxById(conv.inboxId)
          if (res?.inbox) {
            inboxName = inboxName || res.inbox.name
            channelType = channelType || res.inbox.channelType
          }
        } catch {
          // ignore
        }
      }

      let contact: Contact | null = null
      if (conv.contactId) {
        try {
          const cRows = await sql`
            SELECT id, name, phone_number as "phoneNumber", email, avatar_url as "avatarUrl",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM contacts WHERE id = ${conv.contactId} LIMIT 1
          `
          if (cRows && cRows.length > 0) {
            contact = cRows[0] as unknown as Contact
            memoryStore.contacts.set(conv.contactId, contact)
          }
        } catch {
          contact = memoryStore.contacts.get(conv.contactId) || null
        }
      }
      const activeTicket = conv.activeTicketId
        ? await ticketService.getTicketById(conv.activeTicketId)
        : null

      let lastMessage: string | null = null
      try {
        const mRows = await sql`
          SELECT content, status, content_attributes as "contentAttributes" FROM messages
          WHERE conversation_id = ${conv.id}
          ORDER BY created_at DESC LIMIT 1
        `
        if (mRows && mRows.length > 0) {
          const row = mRows[0]
          const attrs = (row.contentAttributes as Record<string, unknown>) || {}
          if (row.status === 'deleted_by_sender' || attrs.isDeletedBySender) {
            lastMessage = '🚫 Pesan telah ditarik'
          } else {
            lastMessage = row.content as string | null
          }
        }
      } catch {
        // ignore
      }

      if (!lastMessage) {
        const convMsgs = memoryStore.messages.get(conv.id)
        if (convMsgs && convMsgs.length > 0) {
          const latest = convMsgs[convMsgs.length - 1]
          const attrs = (latest.contentAttributes as Record<string, unknown>) || {}
          if (latest.status === 'deleted_by_sender' || attrs.isDeletedBySender) {
            lastMessage = '🚫 Pesan telah ditarik'
          } else {
            lastMessage = latest.content || null
          }
        }
      }

      const convRecord = conv as Record<string, unknown>
      const contactRecord = contact as Record<string, unknown> | null
      const isGroup = Boolean(
        convRecord.isGroup ||
          contact?.phoneNumber?.includes('@g.us') ||
          contact?.phoneNumber?.includes('120363') ||
          contact?.identifier?.includes('@g.us') ||
          contact?.identifier?.includes('120363') ||
          contactRecord?.contactType === 'group' ||
          (conv.customAttributes as Record<string, unknown>)?.isGroup,
      )
      const groupJid =
        (convRecord.groupJid as string | undefined) ||
        (conv.customAttributes as Record<string, unknown>)?.groupJid ||
        (contact?.phoneNumber?.includes('@g.us') ? contact.phoneNumber : undefined) ||
        (contact?.identifier?.includes('@g.us') ? contact.identifier : undefined) ||
        (isGroup && contact?.phoneNumber
          ? contact.phoneNumber.includes('@g.us')
            ? contact.phoneNumber
            : `${contact.phoneNumber.replace(/[^0-9]/g, '')}@g.us`
          : undefined)

      result.push({
        ...conv,
        isGroup: isGroup ? true : undefined,
        groupJid: isGroup ? groupJid : undefined,
        inboxName: inboxName || null,
        channelType: channelType || 'whatsapp',
        channel: channelType || 'whatsapp',
        contact,
        activeTicket,
        lastMessage,
      })
    }

    return result
  }

  async updateTicketStatus(
    ticketId: string,
    status: TicketStatus | string,
    snoozedUntil?: string | null,
  ): Promise<Ticket> {
    return ticketService.updateTicketStatus(ticketId, status, snoozedUntil)
  }

  async getTicketById(ticketId: string): Promise<Ticket | null> {
    return ticketService.getTicketById(ticketId)
  }

  async listContacts(): Promise<Contact[]> {
    try {
      const rows = await sql`
        SELECT
          id, name, phone_number as "phoneNumber", email,
          created_at as "createdAt", updated_at as "updatedAt"
        FROM contacts
      `
      if (rows && rows.length > 0) {
        return rows as unknown as Contact[]
      }
    } catch {
      // Memory fallback
    }
    return Array.from(memoryStore.contacts.values())
  }

  async handleEditedMessage(params: {
    targetExternalId: string
    newContent: string
    editedAt?: string
  }): Promise<{ message: Message } | null> {
    const { messageService } = await import('../messages/messages.service')
    const result = await messageService.editMessage(params)
    if (!result) return null

    const convMsgs = memoryStore.messages.get(result.message.conversationId)
    if (convMsgs) {
      const idx = convMsgs.findIndex((m) => m.id === result.message.id)
      if (idx !== -1) {
        convMsgs[idx] = result.message
      }
    }

    return result
  }

  async handleRevokedMessage(params: {
    targetExternalId: string
    revokedAt?: string
  }): Promise<{ message: Message } | null> {
    const { messageService } = await import('../messages/messages.service')
    const result = await messageService.revokeMessage(params)
    if (!result) return null

    const convMsgs = memoryStore.messages.get(result.message.conversationId)
    if (convMsgs) {
      const idx = convMsgs.findIndex((m) => m.id === result.message.id)
      if (idx !== -1) {
        convMsgs[idx] = result.message
      }
    }

    return result
  }
}

export const conversationService = new ConversationService()
