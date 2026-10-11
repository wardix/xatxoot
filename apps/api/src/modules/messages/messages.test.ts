import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { conversationService } from '../conversations/conversations.service'
import { inboxService } from '../inboxes/inboxes.service'
import { type SendMessageInput, messageService, resetMessageStore } from './messages.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Messages Module - Auth Guard', () => {
  it('POST /api/v1/conversations/:id/messages should reject unauthenticated request with 401', async () => {
    const fakeConvId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/conversations/${fakeConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Unauthenticated message' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/conversations/:id/messages should reject unauthenticated request with 401', async () => {
    const fakeConvId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/conversations/${fakeConvId}/messages`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })
})

describe('Messages Module - Input Validation', () => {
  it('POST /api/v1/conversations/:id/messages should return 404 for non-existent conversation', async () => {
    const nonExistent = '99999999-0000-0000-0000-000000000099'
    const res = await app.request(`/api/v1/conversations/${nonExistent}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ content: 'Test reply' }),
    })
    expect(res.status).toBe(404)
  })

  it('POST /api/v1/conversations/:id/messages should return 400 when both content and attachments are empty', async () => {
    // 1. Setup inbox and conversation
    const { inbox } = await inboxService.createInbox({
      name: 'Validation Test Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+628111111001',
        phoneNumberId: '1000000001',
        wabaId: 'waba_00000001',
        accessToken: 'EAAB_val_token',
        webhookVerifyToken: 'val_verify_token',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+628123000001',
      senderPhone: '+628123000001',
      senderName: 'Validation Customer',
      content: 'Halo tes validasi',
    })

    const res = await app.request(`/api/v1/conversations/${inbound.conversation.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ content: '   ', attachments: [] }),
    })

    expect(res.status).toBe(400)
  })
})

describe('Messages Module - WhatsApp Cloud API Outbound Dispatch', () => {
  let cloudInboxId: string
  let cloudConvId: string
  let cloudTicketId: string

  beforeEach(async () => {
    resetMessageStore()

    const { inbox } = await inboxService.createInbox({
      name: 'Support WhatsApp Cloud',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281299990001',
        phoneNumberId: 'phone_id_cloud_9988',
        wabaId: 'waba_id_cloud_9988',
        accessToken: 'EAAB_mock_valid_token_123',
        webhookVerifyToken: 'verify_token_secret',
      },
    })
    cloudInboxId = inbox.id

    const inbound = await conversationService.handleInboundMessage({
      inboxId: cloudInboxId,
      sourceId: '+6281234567890',
      senderPhone: '+6281234567890',
      senderName: 'Pelanggan WA Cloud',
      content: 'Halo kak, mau tanya ongkos kirim ke Bandung',
    })
    cloudConvId = inbound.conversation.id
    cloudTicketId = inbound.ticket.id
  })

  it('should successfully send outbound text message and dispatch to Meta Graph API', async () => {
    const replyText = 'Halo kak! Ongkos kirim ke Bandung Rp 15.000 dengan kurir reguler.'
    const res = await app.request(`/api/v1/conversations/${cloudConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: replyText,
      }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()

    expect(data.message).toBeDefined()
    expect(data.message.conversationId).toBe(cloudConvId)
    expect(data.message.ticketId).toBe(cloudTicketId)
    expect(data.message.senderType).toBe('user')
    expect(data.message.messageType).toBe('outgoing')
    expect(data.message.content).toBe(replyText)
    expect(data.message.status).toBe('sent')
    expect(data.message.externalSourceId).toBeDefined()
    expect(String(data.message.externalSourceId)).toContain('wamid.')

    // Verify side effect: firstReplyCreatedAt updated on ticket
    const ticketCheck = await conversationService.getTicketById(cloudTicketId)
    expect(ticketCheck?.firstReplyCreatedAt).toBeDefined()

    // Verify dispatched Graph API payload in mock store
    const dispatched = messageService.getDispatchedCloudRequests()
    expect(dispatched.length).toBeGreaterThan(0)
    const lastRequest = dispatched[dispatched.length - 1]
    expect(lastRequest.phoneNumberId).toBe('phone_id_cloud_9988')
    expect(lastRequest.to).toBe('+6281234567890')
    expect(lastRequest.payload.messaging_product).toBe('whatsapp')
    expect(lastRequest.payload.type).toBe('text')
    expect(lastRequest.payload.text?.body).toBe(replyText)
  })

  it('should successfully send outbound media attachment via WhatsApp Cloud API', async () => {
    const res = await app.request(`/api/v1/conversations/${cloudConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: 'Berikut dokumen panduan pemakaian produk kami',
        contentType: 'document',
        attachments: [
          {
            fileType: 'application/pdf',
            fileUrl: 'https://cdn.xatxoot.com/manuals/user-guide.pdf',
            fileName: 'user-guide.pdf',
            fileSize: 1048576,
          },
        ],
      }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.message.contentType).toBe('document')
    expect(data.message.status).toBe('sent')
    expect(data.message.externalSourceId).toBeDefined()
    expect(Array.isArray(data.message.attachments)).toBe(true)
    expect(data.message.attachments.length).toBe(1)
    expect(data.message.attachments[0].fileName).toBe('user-guide.pdf')

    // Verify media payload format to Meta
    const dispatched = messageService.getDispatchedCloudRequests()
    const lastRequest = dispatched[dispatched.length - 1]
    expect(lastRequest.payload.type).toBe('document')
    expect(lastRequest.payload.document?.link).toBe(
      'https://cdn.xatxoot.com/manuals/user-guide.pdf',
    )
    expect(lastRequest.payload.document?.filename).toBe('user-guide.pdf')
  })

  it('should handle WhatsApp Cloud 24-hour service window expiry or Meta API error', async () => {
    // Simulate error header to trigger Meta Graph API failure simulation
    const res = await app.request(`/api/v1/conversations/${cloudConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-simulate-error': '24h_expired',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: 'Pesan balasan di luar window 24 jam',
      }),
    })

    // System creates message record marked with 'failed' status and returns informative error
    const data = await res.json()
    expect(data.message).toBeDefined()
    expect(data.message.status).toBe('failed')
    expect(data.message.contentAttributes).toBeDefined()
    expect(data.message.contentAttributes.error).toBeDefined()
  })
})

describe('Messages Module - WhatsApp Unofficial (Baileys) Outbound Dispatch via BullMQ', () => {
  let baileysInboxId: string
  let baileysChannelId: string
  let baileysConvId: string

  beforeEach(async () => {
    resetMessageStore()

    const { inbox, channel } = await inboxService.createInbox({
      name: 'Support Baileys Unofficial',
      channelType: 'whatsapp_unofficial',
      channel: {
        sessionId: 'session_baileys_test_01',
        phoneNumber: '+6281399887766',
      },
    })
    baileysInboxId = inbox.id
    baileysChannelId = channel.id

    const inbound = await conversationService.handleInboundMessage({
      inboxId: baileysInboxId,
      sourceId: '+6281987654321',
      senderPhone: '+6281987654321',
      senderName: 'Pelanggan Baileys',
      content: 'Halo, saya mau konfirmasi pembayaran transfer bank',
    })
    baileysConvId = inbound.conversation.id
  })

  it('should push outbound message to BullMQ queue wa-outbound with correct job format', async () => {
    const replyText = 'Baik kak, transfer bank Anda sudah kami terima dan diverifikasi.'
    const res = await app.request(`/api/v1/conversations/${baileysConvId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        content: replyText,
      }),
    })

    expect(res.status).toBe(201)
    const data = await res.json()

    expect(data.message).toBeDefined()
    expect(data.message.conversationId).toBe(baileysConvId)
    expect(data.message.senderType).toBe('user')
    expect(data.message.messageType).toBe('outgoing')
    expect(data.message.content).toBe(replyText)
    expect(data.message.status).toBe('sent')

    // Verify BullMQ job pushed to wa-outbound queue
    const queuedJobs = messageService.getQueuedBaileysJobs()
    expect(queuedJobs.length).toBeGreaterThan(0)
    const lastJob = queuedJobs[queuedJobs.length - 1]
    expect(lastJob.queue).toBe('wa-outbound')
    expect(lastJob.name).toBe('send-message')
    expect(lastJob.data.channelId).toBe(baileysChannelId)
    expect(lastJob.data.recipientNumber).toBe('+6281987654321')
    expect(lastJob.data.messageType).toBe('text')
    expect(lastJob.data.text).toBe(replyText)
    expect(lastJob.data.messageId).toBe(data.message.id)
  })
})

describe('Messages Module - Thread History (GET /api/v1/conversations/:id/messages)', () => {
  it('should list all messages in conversation chronologically', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'History Test Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+628155555001',
        phoneNumberId: 'phone_history_01',
        wabaId: 'waba_history_01',
        accessToken: 'token_history_01',
        webhookVerifyToken: 'verify_history_01',
      },
    })

    // Inbound message 1 from customer
    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+628177777001',
      senderPhone: '+628177777001',
      senderName: 'History Customer',
      content: 'Pertanyaan pembuka',
    })
    const convId = inbound.conversation.id

    // Outbound reply 1 from agent
    await app.request(`/api/v1/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ content: 'Jawaban agent pertama' }),
    })

    // Fetch conversation messages
    const res = await app.request(`/api/v1/conversations/${convId}/messages`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const messages = await res.json()
    expect(Array.isArray(messages)).toBe(true)
    expect(messages.length).toBeGreaterThanOrEqual(2)
    expect(messages[0].messageType).toBe('incoming')
    expect(messages[1].messageType).toBe('outgoing')
  })
})

describe('Messages Module - Delivery Status Receipts', () => {
  it('should update message delivery status from sent to delivered and read', async () => {
    const { inbox } = await inboxService.createInbox({
      name: 'Receipts Test Inbox',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+628166666001',
        phoneNumberId: 'phone_receipts_01',
        wabaId: 'waba_receipts_01',
        accessToken: 'token_receipts_01',
        webhookVerifyToken: 'verify_receipts_01',
      },
    })

    const inbound = await conversationService.handleInboundMessage({
      inboxId: inbox.id,
      sourceId: '+628188888001',
      senderPhone: '+628188888001',
      senderName: 'Receipts Customer',
      content: 'Pesan tes tanda terima',
    })

    const res = await app.request(`/api/v1/conversations/${inbound.conversation.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ content: 'Balasan agent' }),
    })

    const data = await res.json()
    const messageId = data.message.id
    const externalId = data.message.externalSourceId

    // 1. Simulate delivered receipt
    const delivered = await messageService.updateDeliveryStatus(externalId, 'delivered')
    expect(delivered?.status).toBe('delivered')

    // 2. Simulate read receipt
    const read = await messageService.updateDeliveryStatus(externalId, 'read')
    expect(read?.status).toBe('read')

    // Verify lookup by ID reflects read status
    const verified = await messageService.getMessageById(messageId)
    expect(verified?.status).toBe('read')
  })
})

describe('Messages Module - Service Level Contract', () => {
  it('should export all required methods on messageService', () => {
    expect(messageService).toBeDefined()
    expect(typeof messageService.sendMessage).toBe('function')
    expect(typeof messageService.getMessageById).toBe('function')
    expect(typeof messageService.listConversationMessages).toBe('function')
    expect(typeof messageService.updateDeliveryStatus).toBe('function')
    expect(typeof messageService.dispatchWhatsAppCloud).toBe('function')
    expect(typeof messageService.enqueueBaileysOutbound).toBe('function')
    expect(typeof messageService.getQueuedBaileysJobs).toBe('function')
    expect(typeof messageService.getDispatchedCloudRequests).toBe('function')
  })
})
