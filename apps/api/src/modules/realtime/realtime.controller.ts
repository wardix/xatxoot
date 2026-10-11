import type { Context } from 'hono'
import { streamSSE } from 'hono/streaming'
import { verifyUserToken } from '../auth/auth.service'
import { AsyncEventQueue, type RealtimeEvent, realtimeService } from './realtime.service'

export async function handleStream(c: Context) {
  const authHeader = c.req.header('Authorization')
  const queryToken = c.req.query('token')

  let token: string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim()
  } else if (queryToken) {
    token = queryToken.trim()
  }

  if (!token) {
    return c.json({ error: 'Unauthorized: Missing token' }, 401)
  }

  const user = await verifyUserToken(token)
  if (!user) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401)
  }

  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')

  return streamSSE(c, async (stream) => {
    // 1. Subscribe to realtime broadcast events
    const queue = new AsyncEventQueue<RealtimeEvent>()
    const unsubscribe = realtimeService.subscribe(queue)

    stream.onAbort(() => {
      unsubscribe()
      queue.close()
    })

    // 2. Initial handshake event
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({
        status: 'connected',
        user: user.displayName,
        timestamp: new Date().toISOString(),
      }),
    })

    // 3. Process events until queue closes or stream aborts
    while (!stream.aborted) {
      const event = await queue.next()
      if (!event || stream.aborted) {
        break
      }

      await stream.writeSSE({
        event: event.event,
        data: JSON.stringify(event.data),
        id: event.id || String(Date.now()),
      })
    }

    unsubscribe()
    queue.close()
  })
}
