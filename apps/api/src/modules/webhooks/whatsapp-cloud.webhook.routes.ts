import { Hono } from 'hono'
import { handleMetaChallenge, handleMetaWebhook } from './whatsapp-cloud.webhook.controller'

export const whatsappCloudWebhookRoutes = new Hono()

// Routes support both with :phoneNumberId and root path
whatsappCloudWebhookRoutes.get('/:phoneNumberId', handleMetaChallenge)
whatsappCloudWebhookRoutes.post('/:phoneNumberId', handleMetaWebhook)

whatsappCloudWebhookRoutes.get('/', handleMetaChallenge)
whatsappCloudWebhookRoutes.post('/', handleMetaWebhook)

export default whatsappCloudWebhookRoutes
