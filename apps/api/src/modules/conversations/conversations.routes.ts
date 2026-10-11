import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import { handleGetConversation, handleListConversations } from './conversations.controller'

export const conversationRoutes = new Hono()

conversationRoutes.use('*', authMiddleware)

conversationRoutes.get('/', handleListConversations)
conversationRoutes.get('/:id', handleGetConversation)

export default conversationRoutes
