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

export interface InboundMessagePayload {
  inboxId: string
  sourceId: string
  senderPhone?: string | null
  senderName?: string | null
  content?: string | null
  messageType?: string
  externalId?: string | null
  contentType?: string
  mediaUrl?: string | null
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
        contact.name === 'Nia'

      if (
        dto.name &&
        isPlaceholderName &&
        dto.name !== contact.phoneNumber &&
        dto.name !== 'Unknown'
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

  async handleInboundMessage(payload: InboundMessagePayload): Promise<InboundMessageResult> {
    const now = new Date().toISOString()

    // 1. Find or create Contact & ContactInbox
    const { contact, contactInbox } = await this.findOrCreateContact({
      inboxId: payload.inboxId,
      sourceId: payload.sourceId,
      phone: payload.senderPhone,
      name: payload.senderName,
    })

    // 2. Find or create persistent Conversation thread
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

    // 3. Ticket FSM Lifecycle automation
    let ticket: Ticket
    let isNewTicket = false

    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

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

    // 4. Create Message record
    const convMessages = memoryStore.messages.get(conversation.id) || []

    if (isNewTicket) {
      const ticketActivityMsg: Message = {
        id: crypto.randomUUID(),
        conversationId: conversation.id,
        ticketId: ticket.id,
        senderType: 'system',
        senderId: null,
        messageType: 'activity',
        content: `Tiket #${ticket.displayId || 'T-Baru'} dibuat otomatis dari pesan WhatsApp.`,
        contentType: 'text',
        status: 'sent',
        externalSourceId: null,
        contentAttributes: {},
        attachments: [],
        createdAt: new Date(Date.now() - 50).toISOString(),
        updatedAt: new Date(Date.now() - 50).toISOString(),
      }
      convMessages.push(ticketActivityMsg)
      saveMessageToStore(ticketActivityMsg)

      try {
        await sql`
          INSERT INTO messages (
            id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
            status, external_source_id, content_attributes, created_at, updated_at
          ) VALUES (
            ${ticketActivityMsg.id}, ${ticketActivityMsg.conversationId}, ${ticketActivityMsg.ticketId}, ${ticketActivityMsg.senderType},
            ${null}, ${ticketActivityMsg.messageType}, ${ticketActivityMsg.content}, ${ticketActivityMsg.contentType},
            ${ticketActivityMsg.status}, ${ticketActivityMsg.externalSourceId}, ${JSON.stringify(ticketActivityMsg.contentAttributes)},
            ${ticketActivityMsg.createdAt}, ${ticketActivityMsg.updatedAt}
          )
        `
      } catch {
        // Memory fallback
      }

      realtimeService.broadcast({
        event: 'message.created',
        data: {
          id: ticketActivityMsg.id,
          conversationId: conversation.id,
          content: ticketActivityMsg.content,
          messageType: 'activity',
          contentType: 'text',
          senderType: 'system',
          timestamp: ticketActivityMsg.createdAt,
        },
      })
    }

    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      ticketId: ticket.id,
      senderType: 'contact',
      senderId: contact.id,
      messageType: (payload.messageType as unknown as Message['messageType']) || 'incoming',
      content: payload.content ?? null,
      contentType: (payload.contentType as unknown as Message['contentType']) || 'text',
      status: 'delivered',
      externalSourceId: payload.externalId ?? null,
      contentAttributes: {},
      attachments: [],
      createdAt: now,
      updatedAt: now,
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
    const message: Message = {
      id: crypto.randomUUID(),
      conversationId: conversation.id,
      ticketId: activeTicketId,
      senderType: 'user',
      senderId: null,
      messageType: 'outgoing',
      content: payload.content ?? null,
      contentType: (payload.contentType as unknown as Message['contentType']) || 'text',
      status: 'sent',
      externalSourceId: payload.externalId ?? null,
      contentAttributes: { echo: true },
      attachments: [],
      createdAt: now,
      updatedAt: now,
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
        senderId: message.senderId,
        senderType: message.senderType,
        senderName: 'Petugas CS (WhatsApp HP)',
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
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows && rows.length > 0) {
        conversation = rows[0] as unknown as Conversation
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
               m.message_type as "messageType", m.content_type as "contentType",
               m.content, m.status, m.external_source_id as "externalSourceId",
               m.created_at as "createdAt", m.updated_at as "updatedAt"
        FROM messages m
        LEFT JOIN tickets t ON m.ticket_id = t.id
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
      }
    >
  > {
    let conversations: Conversation[]

    try {
      const rows = filter?.inboxId
        ? await sql`
            SELECT id, inbox_id as "inboxId", contact_id as "contactId",
                   contact_inbox_id as "contactInboxId", active_ticket_id as "activeTicketId",
                   unread_count as "unreadCount", last_message_at as "lastMessageAt",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM conversations
            WHERE inbox_id = ${filter.inboxId}
            ORDER BY last_message_at DESC
          `
        : await sql`
            SELECT id, inbox_id as "inboxId", contact_id as "contactId",
                   contact_inbox_id as "contactInboxId", active_ticket_id as "activeTicketId",
                   unread_count as "unreadCount", last_message_at as "lastMessageAt",
                   created_at as "createdAt", updated_at as "updatedAt"
            FROM conversations
            ORDER BY last_message_at DESC
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

    const result = []
    for (const conv of conversations) {
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
          SELECT content FROM messages
          WHERE conversation_id = ${conv.id}
          ORDER BY created_at DESC LIMIT 1
        `
        if (mRows && mRows.length > 0) {
          lastMessage = mRows[0].content as string | null
        }
      } catch {
        // ignore
      }

      result.push({
        ...conv,
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
}

export const conversationService = new ConversationService()
