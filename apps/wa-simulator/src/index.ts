import { Hono } from 'hono'
import { verifyWebhookChallenge } from './modules/webhook/webhook-verifier'

const app = new Hono()

const DEFAULT_VERIFY_TOKEN = 'xatxoot_verify_token'

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/webhook', (c) => {
  const query = c.req.query()
  const expectedToken = process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN || DEFAULT_VERIFY_TOKEN

  const result = verifyWebhookChallenge(query, expectedToken)

  if (!result.success) {
    return c.text(result.error ?? 'Verification failed', (result.status ?? 400) as 400 | 403)
  }

  return c.text(result.challenge ?? '')
})

export default app
