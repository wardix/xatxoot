import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { messageService } from '../messages/messages.service'
import { ticketService } from '../tickets/tickets.service'
import { type RealtimeEvent, realtimeService } from './realtime.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Realtime SSE Stream - Auth Guard', () => {
  it('GET /api/v1/realtime/stream should reject request without Authorization header or token query with 401', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/realtime/stream should reject invalid token with 401', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-token-xyz',
      },
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/realtime/stream should accept valid Authorization header with 200 text/event-stream', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    expect(res.headers.get('cache-control')).toContain('no-cache')
  })

  it('GET /api/v1/realtime/stream?token=valid-access-token should accept valid token query param with 200 text/event-stream', async () => {
    const res = await app.request('/api/v1/realtime/stream?token=valid-access-token', {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })
})

describe('Realtime SSE Stream - Handshake and Broadcast Events', () => {
  beforeEach(() => {
    realtimeService.resetSubscribers()
  })

  it('should deliver initial connected handshake event upon connection', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body reader not available')
    const chunk = await reader.read()
    const text = new TextDecoder().decode(chunk.value)

    expect(text).toContain('event: connected')
    expect(text).toContain('"status":"connected"')

    realtimeService.closeAllSubscribers()
  })

  it('should broadcast custom events to active connected SSE subscribers', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body reader not available')

    // 1. Read initial handshake
    await reader.read()

    // 2. Broadcast event
    const eventPayload: RealtimeEvent = {
      event: 'agent.presence',
      data: { userId: 'mock-user-id', availability: 'online' },
    }
    realtimeService.broadcast(eventPayload)

    // 3. Read broadcasted event from stream
    const chunk = await reader.read()
    const text = new TextDecoder().decode(chunk.value)

    expect(text).toContain('event: agent.presence')
    expect(text).toContain('"availability":"online"')

    realtimeService.closeAllSubscribers()
  })
})

describe('Realtime SSE Stream - Module Event Integrations', () => {
  beforeEach(() => {
    realtimeService.resetSubscribers()
  })

  it('should broadcast message.created event when customer sends inbound message', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body reader not available')
    // Read initial handshake
    await reader.read()

    // Create inbox & trigger inbound message
    const { inbox } = await inboxService.createInbox({
      name: 'SSE Inbound Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281999990001',
        phoneNumberId: 'phone_sse_01',
        wabaId: 'waba_sse_01',
        accessToken: 'token_sse_01',
        webhookVerifyToken: 'verify_sse_01',
      },
    })

    await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+6281777778888',
      senderPhone: '+6281777778888',
      senderName: 'Pelanggan SSE',
      content: 'Halo dari pelanggan via SSE',
    })

    // Subscriber should receive message.created event
    const chunk = await reader.read()
    const text = new TextDecoder().decode(chunk.value)

    expect(text).toContain('event: message.created')
    expect(text).toContain('Halo dari pelanggan via SSE')

    realtimeService.closeAllSubscribers()
  })

  it('should broadcast message.created event when agent sends outbound reply', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body reader not available')
    await reader.read() // Handshake

    const { inbox } = await inboxService.createInbox({
      name: 'SSE Outbound Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281999990002',
        phoneNumberId: 'phone_sse_02',
        wabaId: 'waba_sse_02',
        accessToken: 'token_sse_02',
        webhookVerifyToken: 'verify_sse_02',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+6281777779999',
      senderPhone: '+6281777779999',
      senderName: 'Pelanggan Outbound SSE',
      content: 'Pertanyaan',
    })

    // Consume the inbound message.created event
    await reader.read()

    // Agent sends outbound reply
    await app.request(`/api/v1/conversations/${inbound.conversation.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ content: 'Balasan agent via SSE' }),
    })

    // Subscriber should receive outbound message.created event
    const chunk = await reader.read()
    const text = new TextDecoder().decode(chunk.value)

    expect(text).toContain('event: message.created')
    expect(text).toContain('Balasan agent via SSE')

    realtimeService.closeAllSubscribers()
  })

  it('should broadcast ticket.updated event when ticket status or sticky note changes', async () => {
    const res = await app.request('/api/v1/realtime/stream', {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    const reader = res.body?.getReader()
    if (!reader) throw new Error('Response body reader not available')
    await reader.read() // Handshake

    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000099',
      status: 'open',
    })

    // Update status to pending
    await app.request(`/api/v1/tickets/${ticket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ status: 'pending' }),
    })

    // Subscriber should receive ticket.updated
    const chunk = await reader.read()
    const text = new TextDecoder().decode(chunk.value)

    expect(text).toContain('event: ticket.updated')
    expect(text).toContain('"status":"pending"')

    realtimeService.closeAllSubscribers()
  })
})

describe('Realtime SSE Stream - Service Level Contract', () => {
  it('should export all required methods on realtimeService', () => {
    expect(realtimeService).toBeDefined()
    expect(typeof realtimeService.broadcast).toBe('function')
    expect(typeof realtimeService.subscribe).toBe('function')
    expect(typeof realtimeService.getActiveSubscriberCount).toBe('function')
    expect(typeof realtimeService.resetSubscribers).toBe('function')
    expect(typeof realtimeService.closeAllSubscribers).toBe('function')
  })
})
