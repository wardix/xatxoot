import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { type InboundMessagePayload, conversationService } from './conversations.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

const MOCK_INBOX_ID = '00000000-1111-2222-3333-444444444444'

describe('Conversations Module - Auth Guard', () => {
  it('GET /api/v1/conversations should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/conversations', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/conversations/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/conversations/${fakeId}`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })
})

describe('Conversations Module - Inbound Message Automation (Contact & Conversation Matching)', () => {
  it('should automatically create new Contact, ContactInbox, Conversation, and open Ticket for first-time sender', async () => {
    const payload: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: '+6281234560001',
      senderPhone: '+6281234560001',
      senderName: 'Budi Pelanggan Baru',
      content: 'Halo, saya mau tanya harga produk X',
      messageType: 'incoming',
      externalId: `wamid.first_time_${Date.now()}`,
    }

    const result = await conversationService.handleInboundMessage(payload)

    expect(result).toBeDefined()
    expect(result.contact).toBeDefined()
    expect(result.contact.phoneNumber).toBe(payload.senderPhone)
    expect(result.contact.name).toBe(payload.senderName)

    expect(result.conversation).toBeDefined()
    expect(result.conversation.inboxId).toBe(MOCK_INBOX_ID)
    expect(result.conversation.id).toBeDefined()

    expect(result.ticket).toBeDefined()
    expect(result.ticket.status).toBe('open')
    expect(result.ticket.conversationId).toBe(result.conversation.id)
    expect(result.isNewTicket).toBe(true)

    expect(result.message).toBeDefined()
    expect(result.message.content).toBe(payload.content)
    expect(result.message.conversationId).toBe(result.conversation.id)
    expect(result.message.ticketId).toBe(result.ticket.id)
  })

  it('should reuse existing Contact & Conversation when the same sender sends another message', async () => {
    const phone = '+6281234560002'
    const firstPayload: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Siti Pelanggan Tetap',
      content: 'Pesan pertama',
      messageType: 'incoming',
      externalId: `wamid.seq1_${Date.now()}`,
    }

    const firstResult = await conversationService.handleInboundMessage(firstPayload)
    const initialContactId = firstResult.contact.id
    const initialConvId = firstResult.conversation.id

    const secondPayload: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Siti Pelanggan Tetap',
      content: 'Pesan kedua dari orang yang sama',
      messageType: 'incoming',
      externalId: `wamid.seq2_${Date.now()}`,
    }

    const secondResult = await conversationService.handleInboundMessage(secondPayload)

    expect(secondResult.contact.id).toBe(initialContactId)
    expect(secondResult.conversation.id).toBe(initialConvId)
    expect(secondResult.isNewTicket).toBe(false)
    expect(secondResult.ticket.id).toBe(firstResult.ticket.id)
  })
})

describe('Conversations Module - Automatic Ticket FSM Lifecycle Rules on Message Inbound', () => {
  it('should attach new inbound message to existing open Ticket without creating a duplicate ticket', async () => {
    const phone = '+6281234560003'
    const payload1: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Rudi Tabuti',
      content: 'Pertanyaan pertama',
      externalId: `wamid.open1_${Date.now()}`,
    }

    const res1 = await conversationService.handleInboundMessage(payload1)
    expect(res1.ticket.status).toBe('open')
    expect(res1.isNewTicket).toBe(true)

    const payload2: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Rudi Tabuti',
      content: 'Pertanyaan susulan saat tiket masih open',
      externalId: `wamid.open2_${Date.now()}`,
    }

    const res2 = await conversationService.handleInboundMessage(payload2)
    expect(res2.isNewTicket).toBe(false)
    expect(res2.ticket.id).toBe(res1.ticket.id)
    expect(res2.ticket.status).toBe('open')
  })

  it('should automatically reopen Ticket from pending back to open when customer sends a reply', async () => {
    const phone = '+6281234560004'
    const payload1: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Dewi Lestari',
      content: 'Butuh bantuan akun',
      externalId: `wamid.pending1_${Date.now()}`,
    }

    const res1 = await conversationService.handleInboundMessage(payload1)
    const ticketId = res1.ticket.id

    // Simulate Agent replied, transitioning ticket to 'pending'
    await conversationService.updateTicketStatus(ticketId, 'pending')
    const ticketAfterAgent = await conversationService.getTicketById(ticketId)
    expect(ticketAfterAgent?.status).toBe('pending')

    // Customer sends a follow-up reply: ticket MUST automatically return to 'open'
    const replyPayload: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Dewi Lestari',
      content: 'Ini bukti transfer yang diminta kemarin',
      externalId: `wamid.pending2_${Date.now()}`,
    }

    const res2 = await conversationService.handleInboundMessage(replyPayload)
    expect(res2.ticket.id).toBe(ticketId)
    expect(res2.ticket.status).toBe('open')
    expect(res2.isNewTicket).toBe(false)
  })

  it('should automatically create a brand new Ticket with status open when customer sends message after previous Ticket resolved', async () => {
    const phone = '+6281234560005'
    const payload1: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Ahmad Dahlan',
      content: 'Isu lama yang sudah selesai',
      externalId: `wamid.resolved1_${Date.now()}`,
    }

    const res1 = await conversationService.handleInboundMessage(payload1)
    const oldTicketId = res1.ticket.id

    // Agent or System resolves the ticket
    await conversationService.updateTicketStatus(oldTicketId, 'resolved')

    // Days/hours later: Customer contacts again in the same Conversation stream
    const payload2: InboundMessagePayload = {
      inboxId: MOCK_INBOX_ID,
      sourceId: phone,
      senderPhone: phone,
      senderName: 'Ahmad Dahlan',
      content: 'Halo admin, saya punya masalah baru dengan pesanan lain',
      externalId: `wamid.resolved2_${Date.now()}`,
    }

    const res2 = await conversationService.handleInboundMessage(payload2)

    expect(res2.conversation.id).toBe(res1.conversation.id)
    expect(res2.isNewTicket).toBe(true)
    expect(res2.ticket.id).not.toBe(oldTicketId)
    expect(res2.ticket.status).toBe('open')

    // Check old ticket remains resolved
    const oldTicketCheck = await conversationService.getTicketById(oldTicketId)
    expect(oldTicketCheck?.status).toBe('resolved')
  })
})

describe('Conversations Module - REST Endpoints', () => {
  it('GET /api/v1/conversations should list conversations with contact & ticket summaries', async () => {
    const res = await app.request('/api/v1/conversations', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /api/v1/conversations/:id should retrieve complete conversation thread with messages', async () => {
    // 1. Seed conversation
    const seeded = await conversationService.handleInboundMessage({
      inboxId: MOCK_INBOX_ID,
      sourceId: '+6281234560099',
      senderPhone: '+6281234560099',
      senderName: 'Test Detail User',
      content: 'Pesan detail thread',
      externalId: `wamid.detail_${Date.now()}`,
    })

    const convId = seeded.conversation.id

    const res = await app.request(`/api/v1/conversations/${convId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.conversation).toBeDefined()
    expect(body.conversation.id).toBe(convId)
    expect(body.contact).toBeDefined()
    expect(body.activeTicket).toBeDefined()
    expect(Array.isArray(body.messages)).toBe(true)
  })

  it('GET /api/v1/conversations/:id should return 404 for non-existent conversation ID', async () => {
    const nonExistent = '99999999-0000-0000-0000-000000000000'
    const res = await app.request(`/api/v1/conversations/${nonExistent}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
  })
})

describe('Conversations Module - Service Level Contract', () => {
  it('should export required methods on conversationService', () => {
    expect(conversationService).toBeDefined()
    expect(typeof conversationService.handleInboundMessage).toBe('function')
    expect(typeof conversationService.getConversationById).toBe('function')
    expect(typeof conversationService.listConversations).toBe('function')
    expect(typeof conversationService.findOrCreateContact).toBe('function')
  })
})
