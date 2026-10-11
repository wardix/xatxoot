import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleListConversationMessages,
  handleSendConversationMessage,
} from './messages.controller'

export const messageRoutes = new Hono()

messageRoutes.use('*', authMiddleware)
messageRoutes.get('/:id/messages', handleListConversationMessages)
messageRoutes.post('/:id/messages', handleSendConversationMessage)

export default messageRoutes
