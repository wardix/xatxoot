import type { Context } from 'hono'
import { conversationService } from './conversations.service'

export async function handleListConversations(c: Context) {
  try {
    const inboxId = c.req.query('inboxId')
    const conversations = await conversationService.listConversations({ inboxId })
    return c.json(conversations, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleGetConversation(c: Context) {
  try {
    const id = c.req.param('id')
    const detail = await conversationService.getConversationById(id)
    if (!detail) {
      return c.json({ error: 'Conversation not found' }, 404)
    }
    return c.json(detail, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}
