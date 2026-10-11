export type PresenceStatus = 'online' | 'busy' | 'offline'

export type LayoutNavTab = 'inbox' | 'contacts' | 'reports' | 'settings'

export type LayoutChannelFilter = 'all' | 'whatsapp' | 'website_widget' | 'api'

export type ChatFilter = 'all' | 'unread' | 'assigned_me' | 'unassigned'

export interface LayoutUser {
  id: string
  name: string
  email: string
  role: string
  status: PresenceStatus
  avatarUrl?: string
}

export interface TicketSummary {
  id: string
  ticketNumber: string
  status: 'open' | 'pending' | 'resolved' | 'snoozed'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assignedTo?: string
}

export interface ConversationItem {
  id: string
  contactName: string
  contactPhone?: string
  contactAvatarUrl?: string
  channel: 'whatsapp' | 'website_widget' | 'api'
  lastMessage?: string
  lastMessageTimestamp?: string
  unreadCount?: number
  presence?: 'online' | 'typing' | 'offline'
  ticket?: TicketSummary
}
