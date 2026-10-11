import { useState } from 'react'
import { WhatsAppLayout } from './components/layout/WhatsAppLayout'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
  PresenceStatus,
} from './components/layout/types'

const INITIAL_USER: LayoutUser = {
  id: 'usr_default_agent',
  name: 'Petugas CS',
  email: 'agent@xatxoot.local',
  role: 'agent',
  status: 'online',
}

const INITIAL_CONVERSATIONS: ConversationItem[] = [
  {
    id: 'conv-1',
    contactName: 'Budi Santoso',
    contactPhone: '+6281234567890',
    channel: 'whatsapp',
    lastMessage: 'Halo min, paket saya dari kemarin belum sampai ya?',
    lastMessageTimestamp: '10:42',
    unreadCount: 2,
    presence: 'online',
    ticket: {
      id: 't-101',
      ticketNumber: 'T-101',
      status: 'open',
      priority: 'high',
      assignedTo: 'usr_default_agent',
    },
  },
  {
    id: 'conv-2',
    contactName: 'Siti Rahma',
    contactPhone: '+6289876543210',
    channel: 'website_widget',
    lastMessage: 'Halo kak, apakah ada diskon untuk pembelian grosir?',
    lastMessageTimestamp: '09:15',
    unreadCount: 0,
    presence: 'offline',
    ticket: {
      id: 't-102',
      ticketNumber: 'T-102',
      status: 'pending',
      priority: 'medium',
    },
  },
  {
    id: 'conv-3',
    contactName: 'Ahmad Fauzi',
    contactPhone: '+6287711223344',
    channel: 'whatsapp',
    lastMessage: 'Baik, terima kasih atas bantuannya kak!',
    lastMessageTimestamp: 'Kemarin',
    unreadCount: 0,
    presence: 'offline',
    ticket: {
      id: 't-103',
      ticketNumber: 'T-103',
      status: 'resolved',
      priority: 'low',
    },
  },
]

export function App() {
  const [user, setUser] = useState<LayoutUser>(INITIAL_USER)
  const [conversations, setConversations] = useState<ConversationItem[]>(INITIAL_CONVERSATIONS)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>('conv-1')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LayoutNavTab>('inbox')
  const [activeChannelFilter, setActiveChannelFilter] = useState<LayoutChannelFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [internalNote, setInternalNote] = useState(
    'Pelanggan VIP. Sering melakukan pemesanan rutin setiap awal bulan.',
  )

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    // Channel filter
    if (activeChannelFilter !== 'all' && c.channel !== activeChannelFilter) {
      return false
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = c.contactName.toLowerCase().includes(q)
      const matchPhone = c.contactPhone?.toLowerCase().includes(q)
      const matchMsg = c.lastMessage?.toLowerCase().includes(q)
      if (!matchName && !matchPhone && !matchMsg) return false
    }

    // Status / Assignment filter
    if (activeFilter === 'unread' && (!c.unreadCount || c.unreadCount === 0)) {
      return false
    }
    if (activeFilter === 'assigned_me' && c.ticket?.assignedTo !== user.id) {
      return false
    }
    if (activeFilter === 'unassigned' && Boolean(c.ticket?.assignedTo)) {
      return false
    }

    return true
  })

  const handleSendMessage = (text: string) => {
    if (!selectedConversationId) return

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              lastMessage: text,
              lastMessageTimestamp: 'Baru saja',
              unreadCount: 0,
            }
          : c,
      ),
    )
  }

  const handleResolveTicket = () => {
    if (!selectedConversationId) return

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                status: 'resolved',
              },
            }
          : c,
      ),
    )
  }

  const handleAssignTicket = () => {
    if (!selectedConversationId) return

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                assignedTo: user.id,
              },
            }
          : c,
      ),
    )
  }

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id)
    // Clear unread
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }

  return (
    <WhatsAppLayout
      currentUser={user}
      conversations={filteredConversations}
      selectedConversationId={selectedConversationId}
      isDrawerOpen={isDrawerOpen}
      activeTab={activeTab}
      activeChannelFilter={activeChannelFilter}
      activeFilter={activeFilter}
      searchQuery={searchQuery}
      internalNote={internalNote}
      onTabChange={setActiveTab}
      onChannelFilterChange={setActiveChannelFilter}
      onPresenceChange={(status: PresenceStatus) => setUser((u) => ({ ...u, status }))}
      onSelectConversation={handleSelectConversation}
      onFilterChange={setActiveFilter}
      onSearchChange={setSearchQuery}
      onNewChat={() => setSelectedConversationId(null)}
      onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
      onCloseDrawer={() => setIsDrawerOpen(false)}
      onSendMessage={handleSendMessage}
      onAssignTicket={handleAssignTicket}
      onResolveTicket={handleResolveTicket}
      onSaveInternalNote={setInternalNote}
    />
  )
}

export default App
