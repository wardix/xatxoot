import type {
  Contact,
  ContactInbox,
  Conversation,
  Message,
  Ticket,
  TicketStatus,
} from '@xatxoot/shared'
import { sql } from '../../db'
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
      if (dto.name && (contact.name === 'Unknown' || !contact.name)) {
        contact = {
          ...contact,
          name: dto.name,
          updatedAt: now,
        }
        memoryStore.contacts.set(contact.id, contact)
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

    const convMessages = memoryStore.messages.get(conversation.id) || []
    convMessages.push(message)
    memoryStore.messages.set(conversation.id, convMessages)

    try {
      await sql`
        INSERT INTO messages (
          id, conversation_id, ticket_id, sender_type, sender_id, message_type, content, content_type,
          status, source_id, content_attributes, created_at, updated_at
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

    return {
      contact,
      conversation,
      ticket,
      isNewTicket,
      message,
    }
  }

  async getConversationById(id: string): Promise<ConversationDetail | null> {
    let conversation = memoryStore.conversations.get(id)

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
          WHERE id = ${id}
          LIMIT 1
        `
        if (rows.length > 0) {
          conversation = rows[0] as unknown as Conversation
          memoryStore.conversations.set(id, conversation)
        }
      } catch {
        // Memory fallback
      }
    }

    if (!conversation) {
      return null
    }

    const contact = conversation.contactId
      ? memoryStore.contacts.get(conversation.contactId) || null
      : null

    const activeTicket = conversation.activeTicketId
      ? await ticketService.getTicketById(conversation.activeTicketId)
      : null

    const messages = memoryStore.messages.get(conversation.id) || []

    return {
      conversation,
      contact,
      activeTicket,
      messages,
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
    let conversations = Array.from(memoryStore.conversations.values())
    if (filter?.inboxId) {
      conversations = conversations.filter((c) => c.inboxId === filter.inboxId)
    }

    const result = []
    for (const conv of conversations) {
      const contact = conv.contactId ? memoryStore.contacts.get(conv.contactId) || null : null
      const activeTicket = conv.activeTicketId
        ? await ticketService.getTicketById(conv.activeTicketId)
        : null
      result.push({
        ...conv,
        contact,
        activeTicket,
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
}

export const conversationService = new ConversationService()
