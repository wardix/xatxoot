import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../apps/wa-simulator/src/index'
import { messageStore } from '../apps/wa-simulator/src/modules/messages/message-store'

describe('WhatsApp Simulator Mock Graph API v18.0+ (Task 1.9)', () => {
  const phoneNumberId = '109876543210'
  const validToken = 'mock_valid_access_token'
  const authHeaders = {
    Authorization: `Bearer ${validToken}`,
    'Content-Type': 'application/json',
  }

  beforeEach(() => {
    messageStore.clear()
  })

  describe('Authentication & Authorization', () => {
    it('should return 401 Unauthorized when Authorization header is missing', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Hello test' },
        }),
      })

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe(190)
      expect(data.error.type).toBe('OAuthException')
    })

    it('should return 401 Unauthorized when Authorization header is not a Bearer token', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: 'Basic invalid_token_format',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Hello test' },
        }),
      })

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error.code).toBe(190)
    })
  })

  describe('Payload Validation', () => {
    it('should return 400 Bad Request when messaging_product is missing or not whatsapp', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'telegram',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Hello' },
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe(100)
    })

    it('should return 400 Bad Request when "to" phone number is missing', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          type: 'text',
          text: { body: 'Hello' },
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error.code).toBe(100)
    })

    it('should return 400 Bad Request when type is missing or unsupported', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'unsupported_type',
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error.code).toBe(100)
    })

    it('should return 400 Bad Request when text body is missing for text type', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: {},
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error.code).toBe(100)
    })
  })

  describe('Successful Message Sending & Payload Types', () => {
    it('should send text message and return Meta JSON response with wamid.mock_xxx', async () => {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '6281234567890',
        type: 'text',
        text: {
          preview_url: false,
          body: 'Halo dari Xatxoot backend!',
        },
      }

      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.messaging_product).toBe('whatsapp')
      expect(data.contacts).toBeArray()
      expect(data.contacts[0].input).toBe('6281234567890')
      expect(data.contacts[0].wa_id).toBe('6281234567890')
      expect(data.messages).toBeArray()
      expect(data.messages[0].id).toStartWith('wamid.mock_')

      // Verifikasi pesan tersimpan di memory store
      const sent = messageStore.getSentMessages(phoneNumberId)
      expect(sent.length).toBe(1)
      expect(sent[0].messageId).toBe(data.messages[0].id)
      expect(sent[0].to).toBe('6281234567890')
      expect(sent[0].type).toBe('text')
      expect(sent[0].payload.text.body).toBe('Halo dari Xatxoot backend!')
    })

    it('should send image media message successfully', async () => {
      const payload = {
        messaging_product: 'whatsapp',
        to: '6281234567890',
        type: 'image',
        image: {
          link: 'https://example.com/invoice.jpg',
          caption: 'Invoice pembelian',
        },
      }

      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.messages[0].id).toStartWith('wamid.mock_')
    })

    it('should send template message successfully', async () => {
      const payload = {
        messaging_product: 'whatsapp',
        to: '6281234567890',
        type: 'template',
        template: {
          name: 'sample_shipping_confirmation',
          language: { code: 'id' },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: 'INV-001' }],
            },
          ],
        },
      }

      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.messages[0].id).toStartWith('wamid.mock_')
    })

    it('should send interactive button message successfully', async () => {
      const payload = {
        messaging_product: 'whatsapp',
        to: '6281234567890',
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: 'Apakah Anda puas dengan layanan kami?' },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'btn_yes', title: 'Puas' } },
              { type: 'reply', reply: { id: 'btn_no', title: 'Tidak Puas' } },
            ],
          },
        },
      }

      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.messages[0].id).toStartWith('wamid.mock_')
    })

    it('should send reaction message successfully', async () => {
      const payload = {
        messaging_product: 'whatsapp',
        to: '6281234567890',
        type: 'reaction',
        reaction: {
          message_id: 'wamid.mock_target_message_123',
          emoji: '👍',
        },
      }

      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.messages[0].id).toStartWith('wamid.mock_')
    })

    it('should support Graph API version flexibility (e.g. /v19.0 or /v20.0)', async () => {
      const payload = {
        messaging_product: 'whatsapp',
        to: '6281234567890',
        type: 'text',
        text: { body: 'Hello version 19.0' },
      }

      const res = await app.request(`/v19.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.messages[0].id).toStartWith('wamid.mock_')
    })
  })

  describe('Simulator Inspection & Reset Endpoints', () => {
    it('should retrieve sent messages via GET /v18.0/:phone_number_id/messages', async () => {
      // Send 2 messages
      await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Pesan 1' },
        }),
      })

      await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Pesan 2' },
        }),
      })

      const getRes = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        headers: authHeaders,
      })
      expect(getRes.status).toBe(200)
      const data = await getRes.json()
      expect(data.data).toBeArray()
      expect(data.data.length).toBe(2)
      expect(data.data[0].payload.text.body).toBe('Pesan 1')
      expect(data.data[1].payload.text.body).toBe('Pesan 2')
    })

    it('should clear stored messages via DELETE /v18.0/:phone_number_id/messages', async () => {
      await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Pesan untuk dihapus' },
        }),
      })

      const delRes = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      expect(delRes.status).toBe(200)

      const getRes = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        headers: authHeaders,
      })
      const data = await getRes.json()
      expect(data.data.length).toBe(0)
    })
  })

  describe('Edge-case & Error Simulation (FR-WS-4)', () => {
    it('should simulate undeliverable error when header x-simulate-error is provided', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'x-simulate-error': 'undeliverable',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Pesan gagal' },
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe(131026)
      expect(data.error.message).toContain('undeliverable')
    })

    it('should simulate 24h conversation expired window error when x-simulate-error is 24h_expired', async () => {
      const res = await app.request(`/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'x-simulate-error': '24h_expired',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: '6281234567890',
          type: 'text',
          text: { body: 'Pesan kedaluwarsa' },
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBeDefined()
      expect(data.error.code).toBe(131047)
      expect(data.error.message).toContain('24 hours')
    })
  })
})
