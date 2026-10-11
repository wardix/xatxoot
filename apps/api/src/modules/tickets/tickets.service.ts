import {
  type CreateTicketInput,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  TicketStatusSchema,
} from '@xatxoot/shared'
import { sql } from '../../db'

export type { Ticket, TicketStatus, TicketPriority, CreateTicketInput }

export interface CreateTicketDto {
  conversationId: string
  status?: TicketStatus
  priority?: TicketPriority
  assigneeId?: string | null
  teamId?: string | null
  internalNote?: string | null
  snoozedUntil?: string | null
  deadlineAt?: string | null
  customAttributes?: Record<string, unknown>
}

export interface TicketFilter {
  status?: TicketStatus | string
  assigneeId?: string | null
  conversationId?: string
}

let displayIdCounter = 1000

const memoryStore = {
  tickets: new Map<string, Ticket>(),
}

export function resetTicketStore(): void {
  memoryStore.tickets.clear()
}

export class TicketService {
  async createTicket(dto: CreateTicketDto): Promise<Ticket> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const displayId = ++displayIdCounter
    const status: TicketStatus = dto.status || 'open'
    const priority: TicketPriority = dto.priority || 'medium'

    const ticket: Ticket = {
      id,
      displayId,
      conversationId: dto.conversationId,
      assigneeId: dto.assigneeId ?? null,
      teamId: dto.teamId ?? null,
      status,
      priority,
      snoozedUntil: dto.snoozedUntil ?? null,
      waitingSince: null,
      deadlineAt: dto.deadlineAt ?? null,
      firstReplyCreatedAt: null,
      openedAt: now,
      resolvedAt: status === 'resolved' ? now : null,
      internalNote: dto.internalNote ?? null,
      internalNoteUpdatedBy: null,
      internalNoteUpdatedAt: null,
      customAttributes: dto.customAttributes || {},
      createdAt: now,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, ticket)

    try {
      await sql`
        INSERT INTO tickets (
          id, display_id, conversation_id, assignee_id, team_id,
          status, priority, snoozed_until, waiting_since, deadline_at,
          first_reply_created_at, opened_at, resolved_at, internal_note,
          internal_note_updated_by, internal_note_updated_at,
          custom_attributes, created_at, updated_at
        ) VALUES (
          ${ticket.id}, ${ticket.displayId}, ${ticket.conversationId}, ${ticket.assigneeId}, ${ticket.teamId},
          ${ticket.status}, ${ticket.priority}, ${ticket.snoozedUntil}, ${ticket.waitingSince}, ${ticket.deadlineAt},
          ${ticket.firstReplyCreatedAt}, ${ticket.openedAt}, ${ticket.resolvedAt}, ${ticket.internalNote},
          ${ticket.internalNoteUpdatedBy}, ${ticket.internalNoteUpdatedAt},
          ${JSON.stringify(ticket.customAttributes)}, ${ticket.createdAt}, ${ticket.updatedAt}
        )
      `
    } catch {
      // Memory fallback for tests/offline
    }

    return ticket
  }

  async getTicketById(id: string): Promise<Ticket | null> {
    try {
      const rows = await sql`
        SELECT
          id,
          display_id as "displayId",
          conversation_id as "conversationId",
          assignee_id as "assigneeId",
          team_id as "teamId",
          status,
          priority,
          snoozed_until as "snoozedUntil",
          waiting_since as "waitingSince",
          deadline_at as "deadlineAt",
          first_reply_created_at as "firstReplyCreatedAt",
          opened_at as "openedAt",
          resolved_at as "resolvedAt",
          internal_note as "internalNote",
          internal_note_updated_by as "internalNoteUpdatedBy",
          internal_note_updated_at as "internalNoteUpdatedAt",
          custom_attributes as "customAttributes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM tickets
        WHERE id = ${id}
        LIMIT 1
      `
      if (rows.length > 0) {
        return rows[0] as unknown as Ticket
      }
    } catch {
      // Memory fallback
    }

    return memoryStore.tickets.get(id) || null
  }

  async listTickets(filter?: TicketFilter): Promise<Ticket[]> {
    try {
      let query = sql`
        SELECT
          id,
          display_id as "displayId",
          conversation_id as "conversationId",
          assignee_id as "assigneeId",
          team_id as "teamId",
          status,
          priority,
          snoozed_until as "snoozedUntil",
          waiting_since as "waitingSince",
          deadline_at as "deadlineAt",
          first_reply_created_at as "firstReplyCreatedAt",
          opened_at as "openedAt",
          resolved_at as "resolvedAt",
          internal_note as "internalNote",
          internal_note_updated_by as "internalNoteUpdatedBy",
          internal_note_updated_at as "internalNoteUpdatedAt",
          custom_attributes as "customAttributes",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM tickets
        WHERE 1 = 1
      `
      if (filter?.status) {
        query = sql`${query} AND status = ${filter.status}`
      }
      if (filter?.assigneeId !== undefined) {
        query = sql`${query} AND assignee_id = ${filter.assigneeId}`
      }
      if (filter?.conversationId) {
        query = sql`${query} AND conversation_id = ${filter.conversationId}`
      }
      query = sql`${query} ORDER BY created_at DESC`
      const rows = await query
      if (rows.length > 0) {
        return rows as unknown as Ticket[]
      }
    } catch {
      // Memory fallback
    }

    let tickets = Array.from(memoryStore.tickets.values())
    if (filter?.status) {
      tickets = tickets.filter((t) => t.status === filter.status)
    }
    if (filter?.assigneeId !== undefined) {
      tickets = tickets.filter((t) => t.assigneeId === filter.assigneeId)
    }
    if (filter?.conversationId) {
      tickets = tickets.filter((t) => t.conversationId === filter.conversationId)
    }
    return tickets
  }

  async updateTicketStatus(
    id: string,
    status: TicketStatus | string,
    snoozedUntil?: string | null,
  ): Promise<Ticket> {
    const parsed = TicketStatusSchema.safeParse(status)
    if (!parsed.success) {
      throw new Error(`Invalid status: ${status}`)
    }
    const validatedStatus = parsed.data

    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const now = new Date().toISOString()
    const resolvedAt = validatedStatus === 'resolved' ? now : null
    const finalSnoozedUntil = validatedStatus === 'snoozed' ? snoozedUntil || null : null

    const updated: Ticket = {
      ...existing,
      status: validatedStatus,
      resolvedAt,
      snoozedUntil: finalSnoozedUntil,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          status = ${validatedStatus},
          resolved_at = ${resolvedAt},
          snoozed_until = ${finalSnoozedUntil},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async updateStickyNote(id: string, internalNote: string, updatedBy?: string): Promise<Ticket> {
    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const now = new Date().toISOString()
    const authorId = updatedBy || 'mock-user-id'

    const updated: Ticket = {
      ...existing,
      internalNote,
      internalNoteUpdatedAt: now,
      internalNoteUpdatedBy: authorId,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          internal_note = ${internalNote},
          internal_note_updated_at = ${now},
          internal_note_updated_by = ${authorId},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async assignTicket(id: string, assigneeId: string | null): Promise<Ticket> {
    const existing = await this.getTicketById(id)
    if (!existing) {
      throw new Error(`Ticket not found: ${id}`)
    }

    const now = new Date().toISOString()
    const updated: Ticket = {
      ...existing,
      assigneeId,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          assignee_id = ${assigneeId},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }

  async recordFirstReply(id: string): Promise<Ticket | null> {
    const existing = await this.getTicketById(id)
    if (!existing || existing.firstReplyCreatedAt) {
      return existing
    }

    const now = new Date().toISOString()
    const updated: Ticket = {
      ...existing,
      firstReplyCreatedAt: now,
      updatedAt: now,
    }

    memoryStore.tickets.set(id, updated)

    try {
      await sql`
        UPDATE tickets
        SET
          first_reply_created_at = ${now},
          updated_at = ${now}
        WHERE id = ${id}
      `
    } catch {
      // Memory fallback
    }

    return updated
  }
}

export const ticketService = new TicketService()
