import { Hono } from 'hono'
import { messageStore } from './message-store'

export const graphMessagesRoutes = new Hono()

const SUPPORTED_MESSAGE_TYPES = new Set([
  'text',
  'image',
  'audio',
  'video',
  'document',
  'sticker',
  'template',
  'interactive',
  'reaction',
  'location',
  'contacts',
])

function checkBearerAuth(authHeader: string | undefined) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: {
        message: 'Invalid OAuth access token - Cannot parse access token',
        type: 'OAuthException',
        code: 190,
        fbtrace_id: `mock_trace_${Date.now()}`,
      },
    }
  }
  return null
}

graphMessagesRoutes.post('/:version/:phoneNumberId/messages', async (c) => {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  const authError = checkBearerAuth(authHeader)
  if (authError) {
    return c.json(authError, 401)
  }

  // Error simulation via header (FR-WS-4)
  const simulateError = c.req.header('x-simulate-error')
  if (simulateError === 'undeliverable') {
    return c.json(
      {
        error: {
          message: 'Message undeliverable: The recipient phone number cannot receive messages.',
          type: 'OAuthException',
          code: 131026,
          fbtrace_id: `mock_trace_${Date.now()}`,
        },
      },
      400,
    )
  }

  if (simulateError === '24h_expired') {
    return c.json(
      {
        error: {
          message:
            'Re-engagement message: More than 24 hours have passed since customer last replied.',
          type: 'OAuthException',
          code: 131047,
          fbtrace_id: `mock_trace_${Date.now()}`,
        },
      },
      400,
    )
  }

  const phoneNumberId = c.req.param('phoneNumberId')
  const body = await c.req.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return c.json(
      {
        error: {
          message: '(#100) Invalid request body.',
          type: 'OAuthException',
          code: 100,
          fbtrace_id: `mock_trace_${Date.now()}`,
        },
      },
      400,
    )
  }

  if (body.messaging_product !== 'whatsapp') {
    return c.json(
      {
        error: {
          message: '(#100) Param messaging_product is required with value whatsapp.',
          type: 'OAuthException',
          code: 100,
          fbtrace_id: `mock_trace_${Date.now()}`,
        },
      },
      400,
    )
  }

  if (!body.to || typeof body.to !== 'string' || body.to.trim() === '') {
    return c.json(
      {
        error: {
          message: '(#100) Param to is required.',
          type: 'OAuthException',
          code: 100,
          fbtrace_id: `mock_trace_${Date.now()}`,
        },
      },
      400,
    )
  }

  if (!body.type || !SUPPORTED_MESSAGE_TYPES.has(body.type)) {
    return c.json(
      {
        error: {
          message: '(#100) Param type is invalid or unsupported.',
          type: 'OAuthException',
          code: 100,
          fbtrace_id: `mock_trace_${Date.now()}`,
        },
      },
      400,
    )
  }

  if (body.type === 'text') {
    if (!body.text || typeof body.text.body !== 'string' || body.text.body.trim() === '') {
      return c.json(
        {
          error: {
            message: '(#100) Param text.body is required for text message type.',
            type: 'OAuthException',
            code: 100,
            fbtrace_id: `mock_trace_${Date.now()}`,
          },
        },
        400,
      )
    }
  }

  const randomSuffix = Math.random().toString(36).substring(2, 9)
  const messageId = `wamid.mock_${Date.now()}_${randomSuffix}`

  messageStore.add({
    phoneNumberId,
    messageId,
    to: body.to,
    type: body.type,
    payload: body,
  })

  return c.json(
    {
      messaging_product: 'whatsapp',
      contacts: [
        {
          input: body.to,
          wa_id: body.to,
        },
      ],
      messages: [
        {
          id: messageId,
        },
      ],
    },
    200,
  )
})

graphMessagesRoutes.get('/:version/:phoneNumberId/messages', (c) => {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  const authError = checkBearerAuth(authHeader)
  if (authError) {
    return c.json(authError, 401)
  }

  const phoneNumberId = c.req.param('phoneNumberId')
  const messages = messageStore.getSentMessages(phoneNumberId)
  return c.json({ data: messages }, 200)
})

graphMessagesRoutes.delete('/:version/:phoneNumberId/messages', (c) => {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  const authError = checkBearerAuth(authHeader)
  if (authError) {
    return c.json(authError, 401)
  }

  const phoneNumberId = c.req.param('phoneNumberId')
  messageStore.clear(phoneNumberId)
  return c.json({ success: true }, 200)
})
