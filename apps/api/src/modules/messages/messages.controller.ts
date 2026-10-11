import type { User } from '@xatxoot/shared'
import type { Context } from 'hono'
import { conversationService } from '../conversations/conversations.service'
import { messageService } from './messages.service'

export async function handleSendConversationMessage(c: Context) {
  try {
    const conversationId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    const hasContent = typeof body.content === 'string' && body.content.trim().length > 0
    const hasAttachments = Array.isArray(body.attachments) && body.attachments.length > 0

    if (!hasContent && !hasAttachments) {
      return c.json({ error: 'Content or attachment is required' }, 400)
    }

    const convDetail = await conversationService.getConversationById(conversationId)
    if (!convDetail) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    const user = c.get('user') as User | undefined
    const simulateError = c.req.header('x-simulate-error')

    const result = await messageService.sendMessage({
      conversationId,
      content: body.content,
      contentType: body.contentType,
      attachments: body.attachments,
      senderType: 'user',
      senderId: user?.id || 'mock-user-id',
      simulateError,
    })

    return c.json({ message: result.message }, 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    if (message.includes('required')) {
      return c.json({ error: message }, 400)
    }
    return c.json({ error: message }, 500)
  }
}

export async function handleListConversationMessages(c: Context) {
  try {
    const conversationId = c.req.param('id')

    const convDetail = await conversationService.getConversationById(conversationId)
    if (!convDetail) {
      return c.json({ error: 'Conversation not found' }, 404)
    }

    const messages = await messageService.listConversationMessages(conversationId)
    return c.json(messages, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}
