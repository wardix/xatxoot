import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleListConversationMessages,
  handleSendConversationMessage,
} from '../messages/messages.controller'
import { handleGetConversation, handleListConversations } from './conversations.controller'

export const conversationRoutes = new Hono()

conversationRoutes.use('*', authMiddleware)

conversationRoutes.get('/', handleListConversations)
conversationRoutes.get('/:id', handleGetConversation)
conversationRoutes.get('/:id/messages', handleListConversationMessages)
conversationRoutes.post('/:id/messages', handleSendConversationMessage)

export default conversationRoutes
