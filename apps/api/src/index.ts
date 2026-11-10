import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { config } from './config'
import { requestIdMiddleware } from './middleware/request-id'
import { reportRoutes } from './modules/analytics/analytics.routes'
import { assignmentRoutes } from './modules/assignment/assignment.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { automationRoutes } from './modules/automation/automation-rules.routes'
import { botFlowRoutes, botSessionRoutes } from './modules/bots/bots.routes'
import {
  businessHoursRoutes,
  inboxBusinessHoursRoutes,
} from './modules/business-hours/business-hours.routes'
import { campaignRoutes } from './modules/campaigns/campaigns.routes'
import { cannedResponseRoutes } from './modules/canned-responses/canned-responses.routes'
import { capacityRoutes } from './modules/capacity/capacity.routes'
import { contactRoutes } from './modules/contacts/contacts.routes'
import { conversationRoutes } from './modules/conversations/conversations.routes'
import { copilotRoutes } from './modules/copilot/copilot.routes'
import { csatRoutes } from './modules/csat/csat.routes'
import { emailRoutes } from './modules/email/email.routes'
import { healthService } from './modules/health/health.service'
import {
  articleRoutes,
  categoryRoutes,
  portalRoutes,
  publicPortalRoutes,
} from './modules/help-center/help-center.routes'
import { inboxRoutes } from './modules/inboxes/inboxes.routes'
import { mediaRoutes } from './modules/media/media.routes'
import { messageRoutes } from './modules/messages/messages.routes'
import { metaSocialRoutes } from './modules/meta-social/meta-social.routes'
import { metricsRegistry } from './modules/metrics/metrics.service'
import { ragRoutes } from './modules/rag/rag.routes'
import { realtimeRoutes } from './modules/realtime/realtime.routes'
import { slaRoutes } from './modules/sla/sla.routes'
import { slashCommandRoutes } from './modules/slash-commands/slash-commands.routes'
import { smsRoutes } from './modules/sms/sms.routes'
import { ssoRoutes } from './modules/sso/sso.routes'
import { teamRoutes } from './modules/teams/teams.routes'
import { telegramRoutes } from './modules/telegram/telegram.routes'
import { ticketRoutes } from './modules/tickets/tickets.routes'
import { userRoutes } from './modules/users/users.routes'
import { whatsappCloudWebhookRoutes } from './modules/webhooks/whatsapp-cloud.webhook.routes'
import { whatsappUnofficialWebhookRoutes } from './modules/webhooks/whatsapp-unofficial.webhook.routes'
import { whatsappTemplateRoutes } from './modules/whatsapp-templates/whatsapp-templates.routes'
import { widgetRoutes } from './modules/widget/widget.routes'
import { openApiApp } from './openapi/openapi'

const app = openApiApp()

app.use('*', requestIdMiddleware)

const allowedOrigins = (config.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return allowedOrigins[0] || 'http://localhost:5173'
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return origin
      }
      return null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-request-id'],
    exposeHeaders: ['x-request-id'],
    credentials: true,
  }),
)

app.use(
  '*',
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    },
  }),
)

// Liveness probe: proses server internal hidup
app.get('/livez', (c) => {
  return c.json(healthService.getLiveness())
})

// Readiness probe: kesiapan dependensi eksternal (PostgreSQL & Redis)
app.get('/readyz', async (c) => {
  const result = await healthService.getReadiness()
  return c.json(result, result.statusCode)
})

// Prometheus metrics endpoint
app.get('/metrics', async () => {
  const metrics = await metricsRegistry.generateMetrics()
  return new Response(metrics, {
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
})

// Backward compatibility health check endpoints
app.get('/health', async (c) => {
  const result = await healthService.getReadiness()
  return c.json(result, result.statusCode)
})

app.get('/healthz', async (c) => {
  const result = await healthService.getReadiness()
  return c.json(result, result.statusCode)
})

app.route('/api/v1/auth', authRoutes)
app.route('/api/v1/inboxes', inboxBusinessHoursRoutes)
app.route('/api/v1/inboxes', inboxRoutes)
app.route('/api/v1/conversations', conversationRoutes)
app.route('/api/v1/messages', messageRoutes)
app.route('/api/v1/contacts', contactRoutes)
app.route('/api/v1/users', userRoutes)
app.route('/api/v1/tickets', ticketRoutes)
app.route('/api/v1/teams', teamRoutes)
app.route('/api/v1/canned-responses', cannedResponseRoutes)
app.route('/api/v1/slash-commands', slashCommandRoutes)
app.route('/api/v1/assignment', assignmentRoutes)
app.route('/api/v1/bot-flows', botFlowRoutes)
app.route('/api/v1/bot-sessions', botSessionRoutes)
app.route('/api/v1/whatsapp-templates', whatsappTemplateRoutes)
app.route('/api/v1/realtime', realtimeRoutes)
app.route('/api/v1/webhooks/whatsapp-cloud', whatsappCloudWebhookRoutes)
app.route('/api/v1/webhooks/whatsapp-unofficial', whatsappUnofficialWebhookRoutes)
app.route('/api/v1/widget', widgetRoutes)
app.route('/api/v1/email', emailRoutes)
app.route('/api/v1/telegram', telegramRoutes)
app.route('/api/v1/meta-social', metaSocialRoutes)
app.route('/api/v1/sms', smsRoutes)
app.route('/api/v1/business-hours', businessHoursRoutes)
app.route('/api/v1/csat', csatRoutes)
app.route('/api/v1/reports', reportRoutes)
app.route('/portal', publicPortalRoutes)
app.route('/api/v1/portals', portalRoutes)
app.route('/api/v1/categories', categoryRoutes)
app.route('/api/v1/articles', articleRoutes)
app.route('/api/v1/automation-rules', automationRoutes)
app.route('/api/v1/campaigns', campaignRoutes)
app.route('/api/v1/rag', ragRoutes)
app.route('/api/v1/copilot', copilotRoutes)
app.route('/api/v1/sla', slaRoutes)
app.route('/api/v1/sso', ssoRoutes)
app.route('/api/v1/capacity', capacityRoutes)
app.route('/api/v1/media', mediaRoutes)

const apiPort = config.PORT_API
const apiHost = config.HOST
;(app as unknown as { port: number; hostname: string }).port = apiPort
;(app as unknown as { port: number; hostname: string }).hostname = apiHost

export default app
