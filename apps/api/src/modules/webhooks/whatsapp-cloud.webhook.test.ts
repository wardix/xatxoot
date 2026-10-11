import { beforeEach, describe, expect, it } from 'bun:test'
import { createHmac } from 'node:crypto'
import app from '../../index'
import {
  parseMetaInboundMessage,
  processMetaWebhookPayload,
  verifyMetaWebhookSignature,
  verifyWebhookChallenge,
} from './whatsapp-cloud.webhook.service'

const APP_SECRET = 'meta_test_app_secret_1234567890'
const PHONE_NUMBER_ID = '109922334455667'
const VERIFY_TOKEN = 'meta_verify_token_super_secret_123'
const WEBHOOK_URL = `/api/v1/webhooks/whatsapp-cloud/${PHONE_NUMBER_ID}`

function generateSignature(payloadString: string, secret: string = APP_SECRET): string {
  const hmac = createHmac('sha256', secret)
  hmac.update(payloadString)
  return `sha256=${hmac.digest('hex')}`
}

function createMetaMessagePayload(messageObj: Record<string, unknown>, contactName = 'John Doe') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba_id_889900',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '62811223344',
                phone_number_id: PHONE_NUMBER_ID,
              },
              contacts: [
                {
                  profile: { name: contactName },
                  wa_id: (messageObj.from as string) || '6281234567890',
                },
              ],
              messages: [messageObj],
            },
            field: 'messages',
          },
        ],
      },
    ],
  }
}

function createMetaStatusPayload(statusObj: Record<string, unknown>) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'waba_id_889900',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '62811223344',
                phone_number_id: PHONE_NUMBER_ID,
              },
              statuses: [statusObj],
            },
            field: 'messages',
          },
        ],
      },
    ],
  }
}

describe('WhatsApp Cloud Webhook - Challenge Handshake (GET)', () => {
  it('should verify challenge and return hub.challenge with 200 when verify_token matches', async () => {
    const challengeText = 'random_challenge_string_12345'
    const query = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': challengeText,
    })

    const res = await app.request(`${WEBHOOK_URL}?${query.toString()}`, {
      method: 'GET',
    })

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe(challengeText)
  })

  it('should reject handshake with 403 Forbidden when hub.verify_token is incorrect', async () => {
    const query = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-verify-token',
      'hub.challenge': 'some_challenge',
    })

    const res = await app.request(`${WEBHOOK_URL}?${query.toString()}`, {
      method: 'GET',
    })

    expect(res.status).toBe(403)
  })

  it('should return 400 Bad Request when hub.mode is not subscribe or required params are missing', async () => {
    const query = new URLSearchParams({
      'hub.mode': 'publish',
      'hub.verify_token': VERIFY_TOKEN,
    })

    const res = await app.request(`${WEBHOOK_URL}?${query.toString()}`, {
      method: 'GET',
    })

    expect(res.status).toBe(400)
  })
})

describe('WhatsApp Cloud Webhook - Signature Verification (POST)', () => {
  it('should reject request without X-Hub-Signature-256 header with 401 or 403', async () => {
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: `wamid.test_unsigned_${Date.now()}`,
      timestamp: '1710000000',
      type: 'text',
      text: { body: 'Halo' },
    })

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    expect([401, 403]).toContain(res.status)
  })

  it('should reject request with mismatched X-Hub-Signature-256 with 401 or 403', async () => {
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: `wamid.test_bad_sig_${Date.now()}`,
      timestamp: '1710000000',
      type: 'text',
      text: { body: 'Halo' },
    })

    const bodyString = JSON.stringify(payload)
    const invalidSignature = generateSignature(bodyString, 'wrong_secret_key')

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': invalidSignature,
      },
      body: bodyString,
    })

    expect([401, 403]).toContain(res.status)
  })

  it('should accept request with valid X-Hub-Signature-256 and process webhook', async () => {
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: `wamid.test_valid_sig_${Date.now()}`,
      timestamp: '1710000000',
      type: 'text',
      text: { body: 'Halo CS, signature valid!' },
    })

    const bodyString = JSON.stringify(payload)
    const validSignature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': validSignature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})

describe('WhatsApp Cloud Webhook - Inbound Message Types', () => {
  it('should receive and process incoming text message', async () => {
    const messageId = `wamid.test_text_${Date.now()}`
    const payload = createMetaMessagePayload(
      {
        from: '6281234567890',
        id: messageId,
        timestamp: '1710000001',
        type: 'text',
        text: { body: 'Tanya info produk nomor 42' },
      },
      'Budi Santoso',
    )

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.processedCount).toBeGreaterThanOrEqual(1)
  })

  it('should receive and process incoming image message with caption', async () => {
    const messageId = `wamid.test_image_${Date.now()}`
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: messageId,
      timestamp: '1710000002',
      type: 'image',
      image: {
        id: 'media_id_image_8899',
        mime_type: 'image/jpeg',
        sha256: 'mock_sha256_hash_value',
        caption: 'Foto bukti transfer pembayaran',
      },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should receive and process incoming document message with filename', async () => {
    const messageId = `wamid.test_doc_${Date.now()}`
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: messageId,
      timestamp: '1710000003',
      type: 'document',
      document: {
        id: 'media_id_doc_1122',
        filename: 'kontrak_layanan.pdf',
        mime_type: 'application/pdf',
        sha256: 'mock_doc_hash_value',
      },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should receive and process incoming audio voice note', async () => {
    const messageId = `wamid.test_audio_${Date.now()}`
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: messageId,
      timestamp: '1710000004',
      type: 'audio',
      audio: {
        id: 'media_id_audio_3344',
        mime_type: 'audio/ogg; codecs=opus',
        voice: true,
      },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should receive and process incoming video message', async () => {
    const messageId = `wamid.test_video_${Date.now()}`
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: messageId,
      timestamp: '1710000005',
      type: 'video',
      video: {
        id: 'media_id_video_5566',
        mime_type: 'video/mp4',
        caption: 'Video unboxing pesanan',
      },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should receive and process interactive button reply', async () => {
    const messageId = `wamid.test_interactive_${Date.now()}`
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: messageId,
      timestamp: '1710000006',
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: {
          id: 'btn_confirm_order_123',
          title: 'Ya, Konfirmasi',
        },
      },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('should receive and process incoming reaction emoji', async () => {
    const messageId = `wamid.test_reaction_${Date.now()}`
    const targetWamid = 'wamid.HBgLTargetMsg12345'
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: messageId,
      timestamp: '1710000007',
      type: 'reaction',
      reaction: {
        message_id: targetWamid,
        emoji: '❤️',
      },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})

describe('WhatsApp Cloud Webhook - Message Idempotency & Retries', () => {
  it('should handle duplicate wamid idempotently and return 200 without duplicate creation', async () => {
    const duplicateWamid = `wamid.test_idempotent_${Date.now()}`
    const payload = createMetaMessagePayload({
      from: '6281234567890',
      id: duplicateWamid,
      timestamp: '1710000010',
      type: 'text',
      text: { body: 'Pesan idempotensi untuk pengujian retry Meta' },
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    // First attempt: should succeed
    const firstRes = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })
    expect(firstRes.status).toBe(200)

    // Second attempt (retry with same wamid): should also return 200 OK without error
    const retryRes = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })
    expect(retryRes.status).toBe(200)
    const retryData = await retryRes.json()
    expect(retryData.success).toBe(true)
    expect(retryData.isDuplicate).toBe(true)
  })
})

describe('WhatsApp Cloud Webhook - Delivery Status Updates', () => {
  it('should process delivery status receipts (sent, delivered, read)', async () => {
    const targetWamid = 'wamid.HBgLMsgForStatusReceipt123'
    const payload = createMetaStatusPayload({
      id: targetWamid,
      status: 'delivered',
      timestamp: '1710000020',
      recipient_id: '6281234567890',
    })

    const bodyString = JSON.stringify(payload)
    const signature = generateSignature(bodyString, APP_SECRET)

    const res = await app.request(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
      },
      body: bodyString,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.statusUpdated).toBe(true)
  })
})

describe('WhatsApp Cloud Webhook - Service Level Contract', () => {
  it('should export verification and parsing helper functions', () => {
    expect(typeof verifyMetaWebhookSignature).toBe('function')
    expect(typeof verifyWebhookChallenge).toBe('function')
    expect(typeof parseMetaInboundMessage).toBe('function')
    expect(typeof processMetaWebhookPayload).toBe('function')
  })

  it('verifyMetaWebhookSignature should return true for valid signature and false for invalid', () => {
    const raw = JSON.stringify({ test: 'hello' })
    const validSig = generateSignature(raw, APP_SECRET)
    expect(verifyMetaWebhookSignature(raw, validSig, APP_SECRET)).toBe(true)
    expect(verifyMetaWebhookSignature(raw, 'sha256=invalidhash', APP_SECRET)).toBe(false)
    expect(verifyMetaWebhookSignature(raw, '', APP_SECRET)).toBe(false)
  })

  it('verifyWebhookChallenge should validate query params properly', () => {
    const validQuery = {
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': '123456',
    }
    expect(verifyWebhookChallenge(validQuery, VERIFY_TOKEN)).toBe('123456')

    const invalidTokenQuery = {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '123456',
    }
    expect(verifyWebhookChallenge(invalidTokenQuery, VERIFY_TOKEN)).toBeNull()

    const wrongModeQuery = {
      'hub.mode': 'unsupported',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': '123456',
    }
    expect(verifyWebhookChallenge(wrongModeQuery, VERIFY_TOKEN)).toBeNull()
  })
})
