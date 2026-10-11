export interface TicketHistoryItem {
  id: string
  ticketNumber: string
  status: 'open' | 'pending' | 'resolved' | 'snoozed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  title?: string
  createdAt: string
  resolvedAt?: string
  assignedTo?: string
}

export interface ActiveTicketData {
  id: string
  ticketNumber: string
  status: 'open' | 'pending' | 'resolved' | 'snoozed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  internalNote?: string
  internalNoteUpdatedAt?: string
  internalNoteUpdatedBy?: string
}

export interface ContactDrawerData {
  contactId: string
  contactName: string
  contactPhone?: string
  contactEmail?: string
  companyName?: string
  avatarUrl?: string
  channel: 'whatsapp' | 'website_widget' | 'api'
  tags?: string[]
  customAttributes?: Record<string, string>
  activeTicket?: ActiveTicketData
  ticketHistory?: TicketHistoryItem[]
}
