import { TicketStatusSchema, type User } from '@xatxoot/shared'
import type { Context } from 'hono'
import { ticketService } from './tickets.service'

export async function handleListTickets(c: Context) {
  try {
    const status = c.req.query('status')
    const assigneeId = c.req.query('assigneeId')
    const conversationId = c.req.query('conversationId')

    const tickets = await ticketService.listTickets({
      status,
      assigneeId,
      conversationId,
    })

    return c.json(tickets, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleGetTicket(c: Context) {
  try {
    const id = c.req.param('id')
    const ticket = await ticketService.getTicketById(id)
    if (!ticket) {
      return c.json({ error: 'Ticket not found' }, 404)
    }

    return c.json({ ticket }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return c.json({ error: message }, 500)
  }
}

export async function handleUpdateStatus(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    const parsedStatus = TicketStatusSchema.safeParse(body.status)
    if (!parsedStatus.success) {
      return c.json({ error: 'Invalid ticket status' }, 400)
    }

    const existing = await ticketService.getTicketById(id)
    if (!existing) {
      return c.json({ error: 'Ticket not found' }, 404)
    }

    const ticket = await ticketService.updateTicketStatus(id, parsedStatus.data, body.snoozedUntil)
    return c.json({ ticket }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}

export async function handleUpdateNote(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    if (body.internalNote === undefined || body.internalNote === null) {
      return c.json({ error: 'internalNote is required' }, 400)
    }

    const existing = await ticketService.getTicketById(id)
    if (!existing) {
      return c.json({ error: 'Ticket not found' }, 404)
    }

    const user = c.get('user') as User | undefined
    const authorId = user?.id || 'mock-user-id'

    const ticket = await ticketService.updateStickyNote(id, String(body.internalNote), authorId)
    return c.json({ ticket }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}

export async function handleAssignee(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    const existing = await ticketService.getTicketById(id)
    if (!existing) {
      return c.json({ error: 'Ticket not found' }, 404)
    }

    const assigneeId = body.assigneeId === null ? null : (body.assigneeId ?? null)
    const ticket = await ticketService.assignTicket(id, assigneeId)
    return c.json({ ticket }, 200)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    if (message.includes('not found')) {
      return c.json({ error: message }, 404)
    }
    return c.json({ error: message }, 500)
  }
}
