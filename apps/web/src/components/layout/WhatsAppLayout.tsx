import { type ReactNode, useState } from 'react'
import { Avatar, Badge, Button, Input } from '../astryx'
import { ChatTimeline, type TimelineMessage } from '../chat'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
  PresenceStatus,
} from './types'

// ==========================================
// Kolom 1: NavRail (60px fixed width)
// ==========================================
export interface NavRailProps {
  currentUser: LayoutUser
  activeTab: LayoutNavTab
  activeChannelFilter: LayoutChannelFilter
  onTabChange: (tab: LayoutNavTab) => void
  onChannelFilterChange: (channel: LayoutChannelFilter) => void
  onPresenceChange: (status: PresenceStatus) => void
  onOpenSettings?: () => void
}

export function NavRail({
  currentUser,
  activeTab,
  activeChannelFilter,
  onTabChange,
  onChannelFilterChange,
  onPresenceChange,
  onOpenSettings,
}: NavRailProps) {
  const [showPresenceMenu, setShowPresenceMenu] = useState(false)

  return (
    <aside
      data-testid="nav-rail"
      className="w-[60px] h-full bg-[#111b21] text-slate-300 flex flex-col items-center py-3.5 justify-between shrink-0 select-none z-20 border-r border-slate-800"
    >
      {/* Top Section: User Avatar & Main Navigation Tabs */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* User Avatar with Presence Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresenceMenu(!showPresenceMenu)}
            className="rounded-full focus:outline-none focus:ring-2 focus:ring-wa-teal-primary cursor-pointer transition-transform hover:scale-105"
            title={`${currentUser.name} (${currentUser.status})`}
          >
            <Avatar
              name={currentUser.name}
              src={currentUser.avatarUrl}
              size="md"
              presence={currentUser.status}
            />
          </button>

          {showPresenceMenu && (
            <div className="absolute left-14 top-0 bg-[#202c33] text-white text-xs rounded-xl shadow-xl border border-slate-700 py-1.5 w-32 z-50">
              <div className="px-3 py-1 font-semibold text-slate-400 border-b border-slate-700/60 mb-1">
                Ubah Status
              </div>
              {(['online', 'busy', 'offline'] as PresenceStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onPresenceChange(st)
                    setShowPresenceMenu(false)
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-slate-700/60 flex items-center gap-2 capitalize ${
                    currentUser.status === st ? 'text-wa-teal-primary font-bold' : 'text-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      st === 'online'
                        ? 'bg-emerald-500'
                        : st === 'busy'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                    }`}
                  />
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-8 h-[1px] bg-slate-800 my-1" />

        {/* Main Navigation Tabs */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            data-testid="nav-tab-inbox"
            data-active={activeTab === 'inbox'}
            onClick={() => onTabChange('inbox')}
            title="Inbox Percakapan"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            💬
          </button>

          <button
            type="button"
            data-testid="nav-tab-contacts"
            data-active={activeTab === 'contacts'}
            onClick={() => onTabChange('contacts')}
            title="Kontak & CRM"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'contacts'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            👥
          </button>

          <button
            type="button"
            data-testid="nav-tab-reports"
            data-active={activeTab === 'reports'}
            onClick={() => onTabChange('reports')}
            title="Laporan & Metrik"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            📊
          </button>

          <button
            type="button"
            data-testid="nav-tab-settings"
            data-active={activeTab === 'settings'}
            onClick={() => {
              onTabChange('settings')
              if (onOpenSettings) onOpenSettings()
            }}
            title="Pengaturan Instance"
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#202c33] text-wa-teal-primary font-bold shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Bottom Section: Quick Channel Filters */}
      <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">
          CH
        </div>

        <button
          type="button"
          data-testid="channel-filter-all"
          data-active={activeChannelFilter === 'all'}
          onClick={() => onChannelFilterChange('all')}
          title="Semua Channel"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'all'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          ALL
        </button>

        <button
          type="button"
          data-testid="channel-filter-whatsapp"
          data-active={activeChannelFilter === 'whatsapp'}
          onClick={() => onChannelFilterChange('whatsapp')}
          title="Filter WhatsApp"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'whatsapp'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          💬
        </button>

        <button
          type="button"
          data-testid="channel-filter-widget"
          data-active={activeChannelFilter === 'widget'}
          onClick={() => onChannelFilterChange('widget')}
          title="Filter Live Chat Widget"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'widget'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          🌐
        </button>

        <button
          type="button"
          data-testid="channel-filter-api"
          data-active={activeChannelFilter === 'api'}
          onClick={() => onChannelFilterChange('api')}
          title="Filter API Channel"
          className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeChannelFilter === 'api'
              ? 'bg-wa-teal-primary text-white font-bold'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          ⚡
        </button>
      </div>
    </aside>
  )
}

// ==========================================
// Kolom 2: ChatListPanel (360px - 400px Bounded)
// ==========================================
export interface ChatListPanelProps {
  conversations: ConversationItem[]
  selectedConversationId?: string | null
  activeFilter: ChatFilter
  searchQuery: string
  onSelectConversation: (id: string) => void
  onFilterChange: (filter: ChatFilter) => void
  onSearchChange: (query: string) => void
  onNewChat: () => void
}

export function ChatListPanel({
  conversations,
  selectedConversationId,
  activeFilter,
  searchQuery,
  onSelectConversation,
  onFilterChange,
  onSearchChange,
  onNewChat,
}: ChatListPanelProps) {
  const getTicketStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'open':
        return 'ticket-open'
      case 'pending':
        return 'ticket-pending'
      case 'resolved':
        return 'ticket-resolved'
      case 'snoozed':
        return 'ticket-snoozed'
      default:
        return 'default'
    }
  }

  const formatTicketStatus = (status?: string) => {
    if (!status) return ''
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  return (
    <section
      data-testid="chat-list-panel"
      className="w-[360px] md:w-[380px] h-full bg-white border-r border-[#e9edef] flex flex-col shrink-0 select-none overflow-hidden"
    >
      {/* Header Bar (#f0f2f5) */}
      <div
        data-testid="chat-list-header"
        className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#e9edef] shrink-0"
      >
        <h2 className="text-xl font-bold text-[#111b21]">Chat</h2>
        <div className="flex items-center gap-2">
          <Button variant="icon" size="icon" onClick={onNewChat} title="Chat Baru / Broadcast">
            ✏️
          </Button>
        </div>
      </div>

      {/* Search Bar Pill */}
      <div className="p-2.5 bg-white border-b border-[#f0f2f5] shrink-0">
        <Input
          data-testid="chat-search-input"
          placeholder="Cari atau mulai chat baru (/)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          icon={<span className="text-slate-400">🔍</span>}
          shortcutHint="/"
        />
      </div>

      {/* Quick Filter Pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-white overflow-x-auto border-b border-[#f0f2f5] shrink-0 scrollbar-none">
        <button
          type="button"
          data-testid="filter-pill-all"
          data-active={activeFilter === 'all'}
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'all'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Semua
        </button>

        <button
          type="button"
          data-testid="filter-pill-unread"
          data-active={activeFilter === 'unread'}
          onClick={() => onFilterChange('unread')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'unread'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Belum Dibaca
        </button>

        <button
          type="button"
          data-testid="filter-pill-assigned_me"
          data-active={activeFilter === 'assigned_me'}
          onClick={() => onFilterChange('assigned_me')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'assigned_me'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Ditugaskan ke Saya
        </button>

        <button
          type="button"
          data-testid="filter-pill-unassigned"
          data-active={activeFilter === 'unassigned'}
          onClick={() => onFilterChange('unassigned')}
          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors whitespace-nowrap cursor-pointer ${
            activeFilter === 'unassigned'
              ? 'bg-[#e7fce3] text-[#008069]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
          }`}
        >
          Belum Ditugaskan
        </button>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-[#667781] text-sm">
            Tidak ada percakapan ditemukan.
          </div>
        ) : (
          conversations.map((conv) => {
            const isSelected = selectedConversationId === conv.id
            return (
              <button
                type="button"
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'
                }`}
              >
                {/* Contact Avatar */}
                <Avatar
                  name={conv.contactName}
                  src={conv.contactAvatarUrl}
                  channel={conv.channel}
                  size="md"
                />

                {/* Info Container */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-sm text-[#111b21] truncate">
                      {conv.contactName}
                    </span>
                    {conv.lastMessageTimestamp && (
                      <span className="text-[11px] text-[#667781] shrink-0 ml-2">
                        {conv.lastMessageTimestamp}
                      </span>
                    )}
                  </div>

                  {/* Ticket Badge & Last Message */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      {conv.ticket && (
                        <span className="text-[11px] font-semibold text-[#008069] shrink-0">
                          #{conv.ticket.ticketNumber} [{formatTicketStatus(conv.ticket.status)}]
                        </span>
                      )}
                      <p className="text-xs text-[#667781] truncate">
                        {conv.lastMessage || 'Tidak ada pesan'}
                      </p>
                    </div>

                    {/* Unread Badge */}
                    {Boolean(conv.unreadCount && conv.unreadCount > 0) && (
                      <Badge variant="wa-unread" data-testid="unread-badge" size="sm">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}

// ==========================================
// Kolom 3: ConversationThread (Flex-1 Canvas Obrolan)
// ==========================================
export interface ConversationThreadProps {
  conversation: ConversationItem | null
  isDrawerOpen: boolean
  messages?: TimelineMessage[]
  onToggleDrawer: () => void
  onSendMessage: (message: string) => void
  onAssignTicket: () => void
  onResolveTicket: () => void
  onRetryMessage?: (message: TimelineMessage) => void
  children?: ReactNode
}

export function ConversationThread({
  conversation,
  isDrawerOpen,
  messages,
  onToggleDrawer,
  onSendMessage,
  onAssignTicket,
  onResolveTicket,
  onRetryMessage,
  children,
}: ConversationThreadProps) {
  const [inputText, setInputText] = useState('')

  if (!conversation) {
    return (
      <main
        data-testid="conversation-empty-state"
        className="flex-1 h-full bg-[#f0f2f5] flex flex-col items-center justify-center p-8 text-center select-none border-b-6 border-[#00a884]"
      >
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-wa-teal-primary text-4xl flex items-center justify-center mb-6 shadow-sm">
          💬
        </div>
        <h2 className="text-2xl font-semibold text-[#41525d] mb-2">Xatxoot Customer Support</h2>
        <p className="text-sm text-[#667781] max-w-md leading-relaxed mb-6">
          Pilih percakapan di bilah kiri untuk membaca pesan dan menangani tiket pelanggan secara
          real-time.
        </p>
        <div className="flex items-center gap-2 text-xs text-[#8696a0]">
          <span>🔒</span>
          <span>End-to-end encrypted dengan WhatsApp Cloud & Baileys Gateway</span>
        </div>
      </main>
    )
  }

  const handleSend = () => {
    if (!inputText.trim()) return
    onSendMessage(inputText)
    setInputText('')
  }

  return (
    <main
      data-testid="conversation-thread"
      className="flex-1 h-full flex flex-col bg-[#efeae2] overflow-hidden"
    >
      {/* Header Percakapan */}
      <header
        data-testid="thread-header"
        className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#e9edef] shrink-0 z-10"
      >
        {/* Contact info pill (Click to open Drawer) */}
        <button
          type="button"
          data-testid="btn-toggle-drawer"
          onClick={onToggleDrawer}
          className="flex items-center gap-3 text-left focus:outline-none hover:bg-slate-200/50 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <Avatar
            name={conversation.contactName}
            src={conversation.contactAvatarUrl}
            channel={conversation.channel}
            size="md"
          />
          <div>
            <h3 className="font-semibold text-sm text-[#111b21] flex items-center gap-1.5 leading-tight">
              <span>{conversation.contactName}</span>
              {conversation.contactPhone && (
                <span className="text-xs font-normal text-[#667781]">
                  ({conversation.contactPhone})
                </span>
              )}
            </h3>
            <p className="text-[11px] text-[#00a884] font-medium leading-tight">
              {conversation.presence === 'typing'
                ? 'mengetik...'
                : conversation.presence || 'online'}
            </p>
          </div>
        </button>

        {/* Quick Ticket Actions */}
        <div className="flex items-center gap-2">
          {conversation.ticket && (
            <span className="text-xs font-semibold px-2 py-1 rounded bg-[#e7fce3] text-[#008069] border border-[#c1f7b7]">
              #{conversation.ticket.ticketNumber}
            </span>
          )}

          <Button
            data-testid="btn-assign-ticket"
            variant="secondary"
            size="sm"
            onClick={onAssignTicket}
          >
            Assign
          </Button>

          <Button
            data-testid="btn-resolve-ticket"
            variant="teal"
            size="sm"
            onClick={onResolveTicket}
          >
            Resolve
          </Button>
        </div>
      </header>

      {/* Canvas Obrolan (Doodle Wallpaper Background) */}
      <div data-testid="doodle-canvas" className="flex-1 overflow-y-auto p-4 wa-doodle-pattern">
        {children ||
          (messages && messages.length > 0 ? (
            <ChatTimeline messages={messages} onRetryMessage={onRetryMessage} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="bg-[#ffffff]/90 backdrop-blur-xs px-4 py-2 rounded-lg shadow-xs text-xs text-[#54656f] border border-[#e9edef] max-w-sm">
                <span className="font-semibold text-emerald-800">Tiket Aktif: </span>
                {conversation.ticket?.ticketNumber || 'T-Baru'} &bull; Mulai percakapan di bawah
                ini.
              </div>
            </div>
          ))}
      </div>

      {/* Bottom Input Bar */}
      <footer
        data-testid="thread-input-bar"
        className="bg-[#f0f2f5] px-4 py-2.5 flex items-center gap-2.5 border-t border-[#e9edef] shrink-0"
      >
        <button
          type="button"
          title="Emoji"
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 text-lg"
        >
          😊
        </button>

        <button
          type="button"
          title="Lampiran Gambar/File"
          className="p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 text-lg"
        >
          📎
        </button>

        <input
          type="text"
          placeholder="Ketik pesan..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          className="flex-1 bg-white text-sm text-[#111b21] rounded-lg px-4 py-2 border border-[#e9edef] focus:outline-none focus:border-wa-teal-primary"
        />

        <Button variant="teal" size="sm" onClick={handleSend} className="rounded-lg px-4 py-2">
          Kirim
        </Button>
      </footer>
    </main>
  )
}

// ==========================================
// Kolom 3.5: ContactDrawer (Slide-Over Context CRM)
// ==========================================
export interface ContactDrawerProps {
  isOpen: boolean
  conversation: ConversationItem | null
  internalNote?: string
  onClose: () => void
  onSaveInternalNote?: (note: string) => void
}

export function ContactDrawer({
  isOpen,
  conversation,
  internalNote = '',
  onClose,
  onSaveInternalNote,
}: ContactDrawerProps) {
  const [noteContent, setNoteContent] = useState(internalNote)

  if (!isOpen || !conversation) {
    return null
  }

  return (
    <aside
      data-testid="contact-crm-drawer"
      className="w-[360px] md:w-[380px] h-full bg-white border-l border-[#e9edef] flex flex-col shrink-0 select-none overflow-hidden z-20 shadow-lg"
    >
      {/* Header Drawer */}
      <div className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#e9edef] shrink-0">
        <h3 className="font-semibold text-base text-[#111b21]">Info Kontak</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60"
          title="Tutup Panel"
        >
          ✕
        </button>
      </div>

      {/* Drawer Body Scroll */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Contact Profile Summary */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-[#f0f2f5]">
          <Avatar
            name={conversation.contactName}
            src={conversation.contactAvatarUrl}
            channel={conversation.channel}
            size="xl"
            className="mb-3"
          />
          <h4 className="font-bold text-lg text-[#111b21]">{conversation.contactName}</h4>
          {conversation.contactPhone && (
            <p className="text-sm text-[#667781]">{conversation.contactPhone}</p>
          )}
          <span className="text-[11px] font-semibold uppercase px-2 py-0.5 mt-2 rounded bg-slate-100 text-slate-600">
            Channel: {conversation.channel}
          </span>
        </div>

        {/* 1:1 Sticky Internal Note Card (#fef3c7) */}
        <div
          data-testid="sticky-internal-note-card"
          className="bg-[#fef3c7] border border-[#fde68a] rounded-xl p-3.5 flex flex-col gap-2 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <span>📌</span>
              <span>1:1 Sticky Internal Note</span>
            </span>
            <span className="text-[10px] text-amber-700 font-medium">Internal Case</span>
          </div>
          <textarea
            rows={3}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Tambahkan catatan kasus internal untuk tiket ini..."
            className="w-full text-xs text-amber-950 bg-amber-50/60 rounded-lg p-2 border border-amber-200 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (onSaveInternalNote) onSaveInternalNote(noteContent)
              }}
              className="text-xs bg-amber-200/80 hover:bg-amber-300 text-amber-900 border-amber-300"
            >
              Simpan Catatan
            </Button>
          </div>
        </div>

        {/* Ticket Details & History */}
        <div
          data-testid="drawer-ticket-info"
          className="border border-[#e9edef] rounded-xl p-3.5 flex flex-col gap-2 bg-[#f9fafb]"
        >
          <h5 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
            Informasi Tiket
          </h5>
          {conversation.ticket ? (
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Nomor Tiket:</span>
                <span className="font-bold text-emerald-800">
                  {conversation.ticket.ticketNumber}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Status:</span>
                <span className="font-medium capitalize text-slate-800">
                  {conversation.ticket.status}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Prioritas:</span>
                <span className="font-semibold uppercase text-rose-700">
                  {conversation.ticket.priority || 'medium'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Belum ada tiket aktif.</p>
          )}
        </div>
      </div>
    </aside>
  )
}

// ==========================================
// Main WhatsAppLayout Orchestrator
// ==========================================
export interface WhatsAppLayoutProps {
  currentUser: LayoutUser
  conversations: ConversationItem[]
  selectedConversationId?: string | null
  isDrawerOpen?: boolean
  activeTab?: LayoutNavTab
  activeChannelFilter?: LayoutChannelFilter
  activeFilter?: ChatFilter
  searchQuery?: string
  internalNote?: string
  onTabChange?: (tab: LayoutNavTab) => void
  onChannelFilterChange?: (channel: LayoutChannelFilter) => void
  onPresenceChange?: (status: PresenceStatus) => void
  onSelectConversation?: (id: string) => void
  onFilterChange?: (filter: ChatFilter) => void
  onSearchChange?: (query: string) => void
  onNewChat?: () => void
  onToggleDrawer?: () => void
  onCloseDrawer?: () => void
  onSendMessage?: (msg: string) => void
  onAssignTicket?: () => void
  onResolveTicket?: () => void
  onSaveInternalNote?: (note: string) => void
  messages?: TimelineMessage[]
  onRetryMessage?: (message: TimelineMessage) => void
  children?: ReactNode
}

export function WhatsAppLayout({
  currentUser,
  conversations,
  selectedConversationId,
  isDrawerOpen = false,
  activeTab = 'inbox',
  activeChannelFilter = 'all',
  activeFilter = 'all',
  searchQuery = '',
  internalNote = '',
  messages,
  onTabChange = () => {},
  onChannelFilterChange = () => {},
  onPresenceChange = () => {},
  onSelectConversation = () => {},
  onFilterChange = () => {},
  onSearchChange = () => {},
  onNewChat = () => {},
  onToggleDrawer = () => {},
  onCloseDrawer = () => {},
  onSendMessage = () => {},
  onAssignTicket = () => {},
  onResolveTicket = () => {},
  onSaveInternalNote = () => {},
  onRetryMessage,
  children,
}: WhatsAppLayoutProps) {
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId) || null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#efeae2] text-[#111b21] antialiased">
      {/* Kolom 1: NavRail */}
      <NavRail
        currentUser={currentUser}
        activeTab={activeTab}
        activeChannelFilter={activeChannelFilter}
        onTabChange={onTabChange}
        onChannelFilterChange={onChannelFilterChange}
        onPresenceChange={onPresenceChange}
      />

      {/* Kolom 2: ChatListPanel */}
      <ChatListPanel
        conversations={conversations}
        selectedConversationId={selectedConversationId}
        activeFilter={activeFilter}
        searchQuery={searchQuery}
        onSelectConversation={onSelectConversation}
        onFilterChange={onFilterChange}
        onSearchChange={onSearchChange}
        onNewChat={onNewChat}
      />

      {/* Kolom 3: ConversationThread */}
      <ConversationThread
        conversation={selectedConversation}
        isDrawerOpen={isDrawerOpen}
        messages={messages}
        onToggleDrawer={onToggleDrawer}
        onSendMessage={onSendMessage}
        onAssignTicket={onAssignTicket}
        onResolveTicket={onResolveTicket}
        onRetryMessage={onRetryMessage}
      >
        {children}
      </ConversationThread>

      {/* Kolom 3.5: ContactDrawer (Slide-Over CRM) */}
      <ContactDrawer
        isOpen={isDrawerOpen}
        conversation={selectedConversation}
        internalNote={internalNote}
        onClose={onCloseDrawer}
        onSaveInternalNote={onSaveInternalNote}
      />
    </div>
  )
}

export default WhatsAppLayout
