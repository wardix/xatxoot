import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../apps/wa-simulator/src/index'
import { webhookHistoryStore } from '../apps/wa-simulator/src/modules/generator/webhook-history-store'
import {
  buildInboundMessagePayload,
  buildStatusReceiptPayload,
  generateMetaSignature,
} from '../apps/wa-simulator/src/modules/generator/webhook-payload-builder'

describe('WhatsApp Simulator Webhook Generator UI/API (Task 1.10)', () => {
  const testSecret = 'test_app_secret_123'

  beforeEach(() => {
    webhookHistoryStore.clear()
  })

  describe('Signature & Payload Builders', () => {
    it('should generate valid Meta HMAC-SHA256 signature prefixed with sha256=', () => {
      const payload = JSON.stringify({ hello: 'world' })
      const signature = generateMetaSignature(payload, testSecret)

      expect(signature).toStartWith('sha256=')
      expect(signature.length).toBe(71) // 'sha256=' (7) + 64 hex chars

      // Verify deterministic output
      const signature2 = generateMetaSignature(payload, testSecret)
      expect(signature2).toBe(signature)

      // Different secret produces different signature
      const signatureDiff = generateMetaSignature(payload, 'different_secret')
      expect(signatureDiff).not.toBe(signature)
    })

    it('should build valid inbound text message webhook payload', () => {
      const payload = buildInboundMessagePayload({
        customerPhone: '6281234567890',
        customerName: 'Budi Santoso',
        phoneNumberId: '109876543210',
        type: 'text',
        text: 'Halo Admin Xatxoot!',
      })

      expect(payload.object).toBe('whatsapp_business_account')
      expect(payload.entry).toBeArray()
      expect(payload.entry[0].changes[0].field).toBe('messages')

      const value = payload.entry[0].changes[0].value
      expect(value.messaging_product).toBe('whatsapp')
      expect(value.metadata.phone_number_id).toBe('109876543210')
      expect(value.contacts[0].profile.name).toBe('Budi Santoso')
      expect(value.contacts[0].wa_id).toBe('6281234567890')

      const msg = value.messages[0]
      expect(msg.from).toBe('6281234567890')
      expect(msg.id).toStartWith('wamid.mock_inbound_')
      expect(msg.type).toBe('text')
      expect(msg.text.body).toBe('Halo Admin Xatxoot!')
    })

    it('should build valid inbound media message webhook payload', () => {
      const payload = buildInboundMessagePayload({
        customerPhone: '6281234567890',
        customerName: 'Budi Santoso',
        type: 'image',
        media: {
          url: 'https://example.com/receipt.jpg',
          caption: 'Bukti transfer',
          mimeType: 'image/jpeg',
        },
      })

      const msg = payload.entry[0].changes[0].value.messages[0]
      expect(msg.type).toBe('image')
      expect(msg.image).toBeDefined()
      expect(msg.image.caption).toBe('Bukti transfer')
      expect(msg.image.mime_type).toBe('image/jpeg')
    })

    it('should build valid delivery status receipt webhook payload', () => {
      const payload = buildStatusReceiptPayload({
        messageId: 'wamid.mock_target_999',
        recipientPhone: '6281234567890',
        status: 'read',
        phoneNumberId: '109876543210',
      })

      expect(payload.object).toBe('whatsapp_business_account')
      const value = payload.entry[0].changes[0].value
      expect(value.statuses).toBeArray()
      expect(value.statuses[0].id).toBe('wamid.mock_target_999')
      expect(value.statuses[0].status).toBe('read')
      expect(value.statuses[0].recipient_id).toBe('6281234567890')
    })
  })

  describe('Webhook Generator API Endpoints', () => {
    it('should return 400 Bad Request if customerPhone is missing on generate', async () => {
      const res = await app.request('/simulator/webhook/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Pesan tanpa nomor telepon',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('customerPhone')
    })

    it('should successfully generate and dispatch inbound webhook', async () => {
      // Mock global fetch for testing dispatch target
      const originalFetch = globalThis.fetch
      let dispatchedUrl = ''
      let dispatchedHeaders: Record<string, string> = {}
      let dispatchedBody = ''

      globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
        dispatchedUrl = url.toString()
        dispatchedHeaders = (init?.headers as Record<string, string>) || {}
        dispatchedBody = init?.body?.toString() || ''
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }) as typeof fetch

      try {
        const res = await app.request('/simulator/webhook/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: 'http://localhost:3000/api/v1/webhooks/whatsapp-cloud',
            appSecret: testSecret,
            customerPhone: '6281234567890',
            customerName: 'Andi Siregar',
            type: 'text',
            text: 'Halo dari simulator generator!',
          }),
        })

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.success).toBe(true)
        expect(data.messageId).toStartWith('wamid.mock_inbound_')
        expect(data.signature).toStartWith('sha256=')
        expect(data.payload).toBeDefined()

        // Verifikasi request dispatch
        expect(dispatchedUrl).toBe('http://localhost:3000/api/v1/webhooks/whatsapp-cloud')
        expect(dispatchedHeaders['X-Hub-Signature-256']).toBe(data.signature)
        expect(dispatchedBody).toBe(JSON.stringify(data.payload))

        // Verifikasi history recorded
        const historyRes = await app.request('/simulator/webhook/history')
        expect(historyRes.status).toBe(200)
        const historyData = await historyRes.json()
        expect(historyData.data.length).toBe(1)
        expect(historyData.data[0].messageId).toBe(data.messageId)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('should generate and dispatch message status update webhook', async () => {
      const originalFetch = globalThis.fetch
      let dispatchedHeaders: Record<string, string> = {}

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        dispatchedHeaders = (init?.headers as Record<string, string>) || {}
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }) as typeof fetch

      try {
        const res = await app.request('/simulator/webhook/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: 'http://localhost:3000/api/v1/webhooks/whatsapp-cloud',
            appSecret: testSecret,
            messageId: 'wamid.mock_sent_112233',
            recipientPhone: '6281234567890',
            status: 'delivered',
          }),
        })

        expect(res.status).toBe(200)
        const data = await res.json()
        expect(data.success).toBe(true)
        expect(data.signature).toStartWith('sha256=')
        expect(dispatchedHeaders['X-Hub-Signature-256']).toBe(data.signature)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('should clear webhook history via DELETE /simulator/webhook/history', async () => {
      webhookHistoryStore.add({
        id: 'mock_history_1',
        type: 'inbound',
        messageId: 'wamid.mock_1',
        targetUrl: 'http://localhost:3000/api/webhook',
        statusCode: 200,
        createdAt: new Date().toISOString(),
      })

      expect(webhookHistoryStore.getAll().length).toBe(1)

      const delRes = await app.request('/simulator/webhook/history', {
        method: 'DELETE',
      })
      expect(delRes.status).toBe(200)
      expect(webhookHistoryStore.getAll().length).toBe(0)
    })
  })

  describe('Mini-UI Web Dashboard (FR-WS-3)', () => {
    it('should serve HTML UI at GET /simulator or GET / with status 200', async () => {
      const res = await app.request('/simulator')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')

      const html = await res.text()
      expect(html).toContain('WhatsApp Cloud API Simulator')
      expect(html).toContain('customerPhone')
      expect(html).toContain('Kirim Pesan Pelanggan')
    })
  })
})
