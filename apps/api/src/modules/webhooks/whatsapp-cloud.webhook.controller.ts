import type { Context } from 'hono'
import {
  DEFAULT_META_APP_SECRET,
  getVerifyTokenForPhoneNumberId,
  processMetaWebhookPayload,
  verifyMetaWebhookSignature,
  verifyWebhookChallenge,
} from './whatsapp-cloud.webhook.service'

export async function handleMetaChallenge(c: Context) {
  const query = c.req.query()
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  if (!mode || mode !== 'subscribe' || !token) {
    return c.text('Bad Request: Invalid or missing query parameters', 400)
  }

  const phoneNumberId = c.req.param('phoneNumberId')
  const expectedToken = await getVerifyTokenForPhoneNumberId(phoneNumberId)

  const validatedChallenge = verifyWebhookChallenge(query, expectedToken)
  if (!validatedChallenge) {
    return c.text('Forbidden: Invalid verification token', 403)
  }

  return c.text(validatedChallenge, 200)
}

export async function handleMetaWebhook(c: Context) {
  const signature = c.req.header('X-Hub-Signature-256')
  if (!signature) {
    return c.json({ error: 'Missing X-Hub-Signature-256 header' }, 401)
  }

  const rawBody = await c.req.text()
  const isValidSignature = verifyMetaWebhookSignature(rawBody, signature, DEFAULT_META_APP_SECRET)
  if (!isValidSignature) {
    return c.json({ error: 'Invalid signature' }, 401)
  }

  try {
    const payload = JSON.parse(rawBody)
    const result = await processMetaWebhookPayload(payload)
    return c.json(result, 200)
  } catch (err) {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }
}
