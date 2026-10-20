import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { messageService, resetMessageStore } from '../messages/messages.service'
import { type RealtimeEvent, realtimeService } from '../realtime/realtime.service'
import { handleWhatsAppUnofficialInbound } from './whatsapp-unofficial.webhook.controller'

describe('WhatsApp Inbound Edited Message Webhook (TDD RED)', () => {
  const app = new Hono()
  app.post('/api/v1/webhooks/whatsapp-unofficial/inbound', handleWhatsAppUnofficialInbound)

  const testChannelId = '11111111-2222-3333-4444-555555555555'
  const testInboxId = '6267b180-e513-46b4-9f89-557cce794875'

  it('should update existing message in-place and record editHistory audit trail', async () => {
    resetMessageStore()

    // 1. Initial inbound message
    const initialRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: testChannelId,
        inboxId: testInboxId,
        senderNumber: '6281122334455',
        senderName: 'Pelanggan Uji Edit',
        externalMessageId: 'ORIGINAL_EXTERNAL_ID_100',
        messageType: 'text',
        content: 'Nomor rekening tujuan: 1234567890 an Budi',
        timestamp: '2026-10-20T08:00:00.000Z',
      }),
    })

    expect(initialRes.status).toBe(200)
    const initialData = (await initialRes.json()) as { messageId: string; conversationId: string }
    expect(initialData.messageId).toBeDefined()

    // 2. Track realtime broadcast
    const broadcastedEvents: RealtimeEvent[] = []
    const originalBroadcast = realtimeService.broadcast.bind(realtimeService)
    realtimeService.broadcast = (event: RealtimeEvent) => {
      broadcastedEvents.push(event)
      originalBroadcast(event)
    }

    try {
      // 3. Inbound edit message
      const editRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: testChannelId,
          inboxId: testInboxId,
          senderNumber: '6281122334455',
          isEdit: true,
          targetExternalId: 'ORIGINAL_EXTERNAL_ID_100',
          newContent: 'Koreksi rekening tujuan: 9876543210 an Budi Santoso',
          editedAt: '2026-10-20T08:05:00.000Z',
        }),
      })

      expect(editRes.status).toBe(200)
      const editData = (await editRes.json()) as { success: boolean; messageId: string }
      expect(editData.success).toBe(true)
      expect(editData.messageId).toBe(initialData.messageId) // In-place update: same message ID!

      // 4. Verify message in messageService
      const updatedMessage = await messageService.getMessageById(initialData.messageId)
      expect(updatedMessage).not.toBeNull()
      expect(updatedMessage?.content).toBe('Koreksi rekening tujuan: 9876543210 an Budi Santoso')
      expect(updatedMessage?.contentAttributes).toBeDefined()

      const attrs = updatedMessage?.contentAttributes as {
        isEdited?: boolean
        editedAt?: string
        editHistory?: Array<{ previousContent: string; editedAt: string }>
      }
      expect(attrs.isEdited).toBe(true)
      expect(attrs.editedAt).toBe('2026-10-20T08:05:00.000Z')
      expect(attrs.editHistory?.length).toBe(1)
      expect(attrs.editHistory?.[0].previousContent).toBe(
        'Nomor rekening tujuan: 1234567890 an Budi',
      )
      expect(attrs.editHistory?.[0].editedAt).toBe('2026-10-20T08:05:00.000Z')

      // 5. Verify Realtime SSE event emitted
      const editEvent = broadcastedEvents.find((e) => e.event === 'message.edited')
      expect(editEvent).toBeDefined()
      // biome-ignore lint/suspicious/noExplicitAny: event payload
      const payload = editEvent?.data as any
      expect(payload.id).toBe(initialData.messageId)
      expect(payload.content).toBe('Koreksi rekening tujuan: 9876543210 an Budi Santoso')
      expect(payload.contentAttributes?.isEdited).toBe(true)
    } finally {
      realtimeService.broadcast = originalBroadcast
    }
  })

  it('should append successive edits into editHistory audit trail', async () => {
    resetMessageStore()

    // Create initial message
    const initialRes = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: testChannelId,
        inboxId: testInboxId,
        senderNumber: '6281122334455',
        externalMessageId: 'MULTI_EDIT_TEST_ID',
        content: 'Versi 1: Original',
        timestamp: '2026-10-20T08:10:00.000Z',
      }),
    })
    const initialData = (await initialRes.json()) as { messageId: string }

    // Edit 1
    await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: testChannelId,
        inboxId: testInboxId,
        senderNumber: '6281122334455',
        isEdit: true,
        targetExternalId: 'MULTI_EDIT_TEST_ID',
        newContent: 'Versi 2: Edit pertama',
        editedAt: '2026-10-20T08:12:00.000Z',
      }),
    })

    // Edit 2
    await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: testChannelId,
        inboxId: testInboxId,
        senderNumber: '6281122334455',
        isEdit: true,
        targetExternalId: 'MULTI_EDIT_TEST_ID',
        newContent: 'Versi 3: Edit final',
        editedAt: '2026-10-20T08:14:00.000Z',
      }),
    })

    const msg = await messageService.getMessageById(initialData.messageId)
    expect(msg?.content).toBe('Versi 3: Edit final')
    // biome-ignore lint/suspicious/noExplicitAny: attributes inspection
    const attrs = msg?.contentAttributes as any
    expect(attrs.editHistory?.length).toBe(2)
    expect(attrs.editHistory[0].previousContent).toBe('Versi 1: Original')
    expect(attrs.editHistory[1].previousContent).toBe('Versi 2: Edit pertama')
  })

  it('should return 404 when targetExternalId does not exist', async () => {
    const res = await app.request('/api/v1/webhooks/whatsapp-unofficial/inbound', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: testChannelId,
        inboxId: testInboxId,
        senderNumber: '6281122334455',
        isEdit: true,
        targetExternalId: 'NON_EXISTENT_EXTERNAL_ID',
        newContent: 'Pesan untuk target yang tidak ada',
      }),
    })

    expect(res.status).toBe(404)
    const data = (await res.json()) as { error: string }
    expect(data.error).toBeDefined()
  })
})
