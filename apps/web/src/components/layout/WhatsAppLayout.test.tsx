import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ChatListPanel,
  ContactDrawer,
  ConversationThread,
  NavRail,
  WhatsAppLayout,
} from './WhatsAppLayout'
import type { ConversationItem, LayoutChannelFilter, LayoutNavTab, PresenceStatus } from './types'

describe('WhatsApp 3.5-Column Layout (Task 1.24 - apps/web)', () => {
  const mockUser = {
    id: 'user-001',
    name: 'Sarah Connor',
    email: 'sarah@xatxoot.local',
    role: 'agent',
    status: 'online' as PresenceStatus,
    avatarUrl: 'https://example.com/avatar.png',
  }

  const mockConversations: ConversationItem[] = [
    {
      id: 'conv-1',
      contactName: 'Budi Santoso',
      contactPhone: '+6281234567890',
      channel: 'whatsapp',
      lastMessage: 'Halo, pesanan saya #1234 sudah dikirim belum ya?',
      lastMessageTimestamp: '10:45',
      unreadCount: 3,
      ticket: {
        id: 't-101',
        ticketNumber: 'T-101',
        status: 'open',
        priority: 'high',
        assignedTo: 'user-001',
      },
    },
    {
      id: 'conv-2',
      contactName: 'Siti Rahma',
      contactPhone: '+6289876543210',
      channel: 'website_widget',
      lastMessage: 'Terima kasih atas bantuannya kak!',
      lastMessageTimestamp: '09:12',
      unreadCount: 0,
      ticket: {
        id: 't-102',
        ticketNumber: 'T-102',
        status: 'resolved',
        priority: 'low',
      },
    },
  ]

  describe('NavRail (Kolom 1: 60px Fixed Navigation)', () => {
    it('should render fixed 60px width nav rail with user avatar and presence status', () => {
      const html = renderToStaticMarkup(
        <NavRail
          currentUser={mockUser}
          activeTab="inbox"
          activeChannelFilter="all"
          onTabChange={() => {}}
          onChannelFilterChange={() => {}}
          onPresenceChange={() => {}}
        />,
      )

      // Fixed 60px width nav rail
      expect(html).toContain('w-[60px]')
      expect(html).toContain('data-testid="nav-rail"')

      // User presence status
      expect(html).toContain('data-testid="presence-indicator"')
      expect(html).toContain('title="Status: online"')

      // Navigation menu items: inbox, contacts, reports, settings
      expect(html).toContain('data-testid="nav-tab-inbox"')
      expect(html).toContain('data-testid="nav-tab-contacts"')
      expect(html).toContain('data-testid="nav-tab-reports"')
      expect(html).toContain('data-testid="nav-tab-settings"')

      // Quick channel filters: all, whatsapp, widget, api
      expect(html).toContain('data-testid="channel-filter-all"')
      expect(html).toContain('data-testid="channel-filter-whatsapp"')
      expect(html).toContain('data-testid="channel-filter-widget"')
      expect(html).toContain('data-testid="channel-filter-api"')
    })

    it('should mark active navigation tab and channel filter correctly', () => {
      const html = renderToStaticMarkup(
        <NavRail
          currentUser={mockUser}
          activeTab="contacts"
          activeChannelFilter="whatsapp"
          onTabChange={() => {}}
          onChannelFilterChange={() => {}}
          onPresenceChange={() => {}}
        />,
      )

      expect(html).toContain('data-active="true"')
    })
  })

  describe('ChatListPanel (Kolom 2: 360px - 400px Resizable/Bounded Panel)', () => {
    it('should render chat list header with wa-header-bg and search bar pill', () => {
      const html = renderToStaticMarkup(
        <ChatListPanel
          conversations={mockConversations}
          selectedConversationId="conv-1"
          activeFilter="all"
          searchQuery=""
          onSelectConversation={() => {}}
          onFilterChange={() => {}}
          onSearchChange={() => {}}
          onNewChat={() => {}}
        />,
      )

      expect(html).toContain('data-testid="chat-list-panel"')
      expect(html).toContain('w-[360px]') // Bounded chat list width
      expect(html).toContain('data-testid="chat-list-header"')
      expect(html).toContain('data-testid="chat-search-input"')
      expect(html).toContain('placeholder="Cari atau mulai chat baru (/)"')

      // Quick filter pills
      expect(html).toContain('data-testid="filter-pill-all"')
      expect(html).toContain('data-testid="filter-pill-unread"')
      expect(html).toContain('data-testid="filter-pill-assigned_me"')
      expect(html).toContain('data-testid="filter-pill-unassigned"')
    })

    it('should display conversation items with WhatsApp Web styling, ticket badge, and unread badge', () => {
      const html = renderToStaticMarkup(
        <ChatListPanel
          conversations={mockConversations}
          selectedConversationId="conv-1"
          activeFilter="all"
          searchQuery=""
          onSelectConversation={() => {}}
          onFilterChange={() => {}}
          onSearchChange={() => {}}
          onNewChat={() => {}}
        />,
      )

      // Conversation 1 details
      expect(html).toContain('Budi Santoso')
      expect(html).toContain('Halo, pesanan saya #1234')
      expect(html).toContain('10:45')
      expect(html).toContain('3') // Unread badge count
      expect(html).toContain('data-testid="unread-badge"')
      expect(html).toContain('#T-101') // Ticket badge
      expect(html).toContain('[Open]')

      // Conversation 2 details
      expect(html).toContain('Siti Rahma')
      expect(html).toContain('#T-102')
      expect(html).toContain('[Resolved]')
    })
  })

  describe('ConversationThread (Kolom 3: Flex-1 Canvas Obrolan)', () => {
    it('should render empty state when no conversation is selected', () => {
      const html = renderToStaticMarkup(
        <ConversationThread
          conversation={null}
          isDrawerOpen={false}
          onToggleDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
        />,
      )

      expect(html).toContain('data-testid="conversation-empty-state"')
      expect(html).toContain('Xatxoot Customer Support')
      expect(html).toContain('Pilih percakapan di bilah kiri')
    })

    it('should render conversation thread with doodle canvas, header actions, and input bar when selected', () => {
      const activeConv = mockConversations[0]
      const html = renderToStaticMarkup(
        <ConversationThread
          conversation={activeConv}
          isDrawerOpen={false}
          onToggleDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
        />,
      )

      expect(html).toContain('data-testid="conversation-thread"')
      expect(html).toContain('Budi Santoso')
      expect(html).toContain('+6281234567890')
      expect(html).toContain('online') // Presence status
      expect(html).toContain('data-testid="thread-header"')
      expect(html).toContain('data-testid="doodle-canvas"') // WhatsApp doodle wallpaper canvas
      expect(html).toContain('data-testid="thread-input-bar"')
      expect(html).toContain('data-testid="btn-toggle-drawer"')
      expect(html).toContain('data-testid="btn-resolve-ticket"')
      expect(html).toContain('data-testid="btn-assign-ticket"')
    })
  })

  describe('ContactDrawer (Kolom 3.5: Slide-Over Context CRM Drawer)', () => {
    const activeConv = mockConversations[0]

    it('should render CRM drawer with sticky internal note and ticket info when open', () => {
      const html = renderToStaticMarkup(
        <ContactDrawer
          isOpen={true}
          conversation={activeConv}
          internalNote="Pelanggan prioritas tinggi, kendala pengiriman ekspedisi."
          onClose={() => {}}
          onSaveInternalNote={() => {}}
        />,
      )

      expect(html).toContain('data-testid="contact-crm-drawer"')
      expect(html).toContain('w-[360px]')
      expect(html).toContain('Info Kontak')
      expect(html).toContain('Budi Santoso')
      expect(html).toContain('+6281234567890')

      // 1:1 Sticky Internal Note Card
      expect(html).toContain('data-testid="sticky-internal-note-card"')
      expect(html).toContain('Pelanggan prioritas tinggi')

      // Ticket history & information
      expect(html).toContain('data-testid="drawer-ticket-info"')
      expect(html).toContain('T-101')
      expect(html).toContain('high')
    })

    it('should not render visible content when drawer is closed', () => {
      const html = renderToStaticMarkup(
        <ContactDrawer
          isOpen={false}
          conversation={activeConv}
          internalNote=""
          onClose={() => {}}
          onSaveInternalNote={() => {}}
        />,
      )

      expect(html).not.toContain('data-testid="contact-crm-drawer"')
    })
  })

  describe('WhatsAppLayout (Full 3.5-Column Integration)', () => {
    it('should assemble all 3.5 columns in a single responsive layout with Astryx tokens', () => {
      const html = renderToStaticMarkup(
        <WhatsAppLayout
          currentUser={mockUser}
          conversations={mockConversations}
          selectedConversationId="conv-1"
          isDrawerOpen={true}
          activeTab="inbox"
          activeChannelFilter="all"
          activeFilter="all"
          searchQuery=""
          internalNote="Catatan kasus 1:1"
          onTabChange={() => {}}
          onChannelFilterChange={() => {}}
          onPresenceChange={() => {}}
          onSelectConversation={() => {}}
          onFilterChange={() => {}}
          onSearchChange={() => {}}
          onNewChat={() => {}}
          onToggleDrawer={() => {}}
          onCloseDrawer={() => {}}
          onSendMessage={() => {}}
          onAssignTicket={() => {}}
          onResolveTicket={() => {}}
          onSaveInternalNote={() => {}}
        />,
      )

      // Column 1: Nav Rail (60px)
      expect(html).toContain('data-testid="nav-rail"')

      // Column 2: Chat List Panel (360px)
      expect(html).toContain('data-testid="chat-list-panel"')

      // Column 3: Conversation Thread (flex-1)
      expect(html).toContain('data-testid="conversation-thread"')

      // Column 3.5: Contact CRM Drawer (slide-over)
      expect(html).toContain('data-testid="contact-crm-drawer"')
      expect(html).toContain('data-testid="sticky-internal-note-card"')
    })
  })
})
