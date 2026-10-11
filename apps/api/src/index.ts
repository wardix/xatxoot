import { Hono } from 'hono'
import { authRoutes } from './modules/auth/auth.routes'
import { inboxRoutes } from './modules/inboxes/inboxes.routes'
import { whatsappCloudWebhookRoutes } from './modules/webhooks/whatsapp-cloud.webhook.routes'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/inboxes', inboxRoutes)
app.route('/api/v1/webhooks/whatsapp-cloud', whatsappCloudWebhookRoutes)

export default app
