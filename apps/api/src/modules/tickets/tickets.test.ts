import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import { ticketService } from './tickets.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Tickets Module - Auth Guard', () => {
  it('GET /api/v1/tickets should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/tickets', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/tickets/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/tickets/${fakeId}`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/tickets/:id/status should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/tickets/${fakeId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/tickets/:id/note should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/tickets/${fakeId}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ internalNote: 'Secret note' }),
    })
    expect(res.status).toBe(401)
  })
})

describe('Tickets Module - FSM Status Transitions (PATCH /api/v1/tickets/:id/status)', () => {
  it('should transition status from open to pending', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000001',
      status: 'open',
      priority: 'medium',
    })

    const res = await app.request(`/api/v1/tickets/${ticket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ status: 'pending' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket.status).toBe('pending')
  })

  it('should transition status from pending to resolved with resolvedAt timestamp', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000002',
      status: 'pending',
      priority: 'high',
    })

    const res = await app.request(`/api/v1/tickets/${ticket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ status: 'resolved' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket.status).toBe('resolved')
    expect(data.ticket.resolvedAt).toBeDefined()
  })

  it('should transition status to snoozed with snoozedUntil timestamp', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000003',
      status: 'open',
      priority: 'low',
    })

    const snoozeTime = new Date(Date.now() + 86400000).toISOString()
    const res = await app.request(`/api/v1/tickets/${ticket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        status: 'snoozed',
        snoozedUntil: snoozeTime,
      }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket.status).toBe('snoozed')
    expect(data.ticket.snoozedUntil).toBe(snoozeTime)
  })

  it('should reject invalid status with 400 Bad Request', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000004',
      status: 'open',
    })

    const res = await app.request(`/api/v1/tickets/${ticket.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ status: 'invalid_status_value' }),
    })

    expect(res.status).toBe(400)
  })

  it('should return 404 when updating status of non-existent ticket', async () => {
    const nonExistent = '99999999-0000-0000-0000-000000000099'
    const res = await app.request(`/api/v1/tickets/${nonExistent}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ status: 'resolved' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('Tickets Module - 1:1 Sticky Case Note (PATCH /api/v1/tickets/:id/note)', () => {
  it('should update 1:1 sticky internal note with updated_by and timestamp', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000005',
      status: 'open',
      priority: 'urgent',
    })

    const noteText = 'Pelanggan meminta percepatan garansi barang rusak order #TRX-9988'
    const res = await app.request(`/api/v1/tickets/${ticket.id}/note`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ internalNote: noteText }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket.internalNote).toBe(noteText)
    expect(data.ticket.internalNoteUpdatedAt).toBeDefined()
    expect(data.ticket.internalNoteUpdatedBy).toBeDefined()
  })

  it('should allow clearing sticky internal note', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000006',
      status: 'open',
      internalNote: 'Catatan awal yang akan dihapus',
    })

    const res = await app.request(`/api/v1/tickets/${ticket.id}/note`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ internalNote: '' }),
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket.internalNote).toBe('')
  })

  it('should return 404 when updating note on non-existent ticket', async () => {
    const nonExistent = '88888888-0000-0000-0000-000000000088'
    const res = await app.request(`/api/v1/tickets/${nonExistent}/note`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ internalNote: 'Note fail' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('Tickets Module - List, Read, and Assign Endpoints', () => {
  it('GET /api/v1/tickets should return list of tickets with filters', async () => {
    const res = await app.request('/api/v1/tickets?status=open', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('GET /api/v1/tickets/:id should retrieve ticket details with sticky note', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000007',
      status: 'open',
      internalNote: 'Detail sticky note test',
    })

    const res = await app.request(`/api/v1/tickets/${ticket.id}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ticket.id).toBe(ticket.id)
    expect(data.ticket.internalNote).toBe('Detail sticky note test')
  })

  it('PATCH /api/v1/tickets/:id/assignee should assign and unassign agent to ticket', async () => {
    const ticket = await ticketService.createTicket({
      conversationId: '00000000-conv-0000-0000-000000000008',
      status: 'open',
    })

    const agentId = '22222222-3333-4444-5555-666666666666'

    // 1. Assign agent
    const assignRes = await app.request(`/api/v1/tickets/${ticket.id}/assignee`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ assigneeId: agentId }),
    })

    expect(assignRes.status).toBe(200)
    const assignedData = await assignRes.json()
    expect(assignedData.ticket.assigneeId).toBe(agentId)

    // 2. Unassign agent
    const unassignRes = await app.request(`/api/v1/tickets/${ticket.id}/assignee`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({ assigneeId: null }),
    })

    expect(unassignRes.status).toBe(200)
    const unassignedData = await unassignRes.json()
    expect(unassignedData.ticket.assigneeId).toBeNull()
  })
})

describe('Tickets Module - Service Level Contract', () => {
  it('should export all required methods on ticketService', () => {
    expect(ticketService).toBeDefined()
    expect(typeof ticketService.createTicket).toBe('function')
    expect(typeof ticketService.getTicketById).toBe('function')
    expect(typeof ticketService.listTickets).toBe('function')
    expect(typeof ticketService.updateTicketStatus).toBe('function')
    expect(typeof ticketService.updateStickyNote).toBe('function')
    expect(typeof ticketService.assignTicket).toBe('function')
  })
})
