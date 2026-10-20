import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ContentType, MessageType, TimelineMessage } from '../components/chat'
import type {
  ChatFilter,
  ConversationItem,
  LayoutChannelFilter,
  LayoutNavTab,
  LayoutUser,
} from '../components/layout/types'
import { api } from '../services/apiClient'
import type { MessageCreatedEvent, TicketUpdatedEvent } from './types'
import {
  applyRealtimeMessage,
  applyRealtimeMessageEdit,
  applyRealtimeMessageStatus,
  applyRealtimeTicket,
  useRealtimeStream,
} from './useRealtimeStream'

export interface UseConversationChatOptions {
  user: LayoutUser
  initialConversationId?: string | null
}

function formatDateGroup(dateStr?: string | Date): string {
  if (!dateStr) return 'HARI INI'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return 'HARI INI'
  const today = new Date()
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  if (isToday) return 'HARI INI'

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear()
  if (isYesterday) return 'KEMARIN'

  return d
    .toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase()
}

export function areMessagesIdentical(
  current?: TimelineMessage[],
  incoming?: TimelineMessage[],
): boolean {
  if (!current || !incoming) return false
  if (current.length !== incoming.length) return false
  return current.every(
    (msg, i) =>
      msg.id === incoming[i]?.id &&
      msg.status === incoming[i]?.status &&
      msg.content === incoming[i]?.content,
  )
}

export interface FilterConversationOptions {
  activeChannelFilter?: LayoutChannelFilter | string
  searchQuery?: string
  activeFilter?: ChatFilter | string
  userId?: string
}

export function filterConversations(
  conversations: ConversationItem[],
  options: FilterConversationOptions = {},
): ConversationItem[] {
  const { activeChannelFilter = 'all', searchQuery = '', activeFilter = 'all', userId } = options

  const trimmedQuery = searchQuery.trim().toLowerCase()

  return conversations.filter((c) => {
    // Channel filter
    if (activeChannelFilter !== 'all' && c.channel !== activeChannelFilter) {
      return false
    }

    // Search query filter
    if (trimmedQuery !== '') {
      const contactNameStr = String(c.contactName || '').toLowerCase()
      const contactPhoneStr = String(c.contactPhone || '').toLowerCase()
      const lastMsgStr = String(c.lastMessage || '').toLowerCase()
      const ticketNumStr = String(c.ticket?.ticketNumber || c.ticket?.id || '').toLowerCase()

      const matchName = contactNameStr.includes(trimmedQuery)
      const matchPhone = contactPhoneStr.includes(trimmedQuery)
      const matchMsg = lastMsgStr.includes(trimmedQuery)
      const matchTicket = ticketNumStr.includes(trimmedQuery)

      if (!matchName && !matchPhone && !matchMsg && !matchTicket) {
        return false
      }
    }

    // Quick filter pills
    if (activeFilter === 'unread' && (c.unreadCount ?? 0) === 0) return false
    if (activeFilter === 'assigned_me') {
      return Boolean(c.ticket?.assignedTo && c.ticket.assignedTo === userId)
    }
    if (activeFilter === 'unassigned') {
      return Boolean(c.ticket && !c.ticket.assignedTo)
    }

    return true
  })
}

export function useConversationChat({ user, initialConversationId }: UseConversationChatOptions) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [messagesMap, setMessagesMap] = useState<Record<string, TimelineMessage[]>>({})
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    initialConversationId || null,
  )
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selectedConversationId

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LayoutNavTab>('inbox')
  const [activeChannelFilter, setActiveChannelFilter] = useState<LayoutChannelFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ChatFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [internalNote, setInternalNote] = useState('')

  // Initial load: Fetch conversations from backend API
  const fetchConversations = useCallback(async () => {
    try {
      // biome-ignore lint/suspicious/noExplicitAny: backend conversation item
      const data = await api.get<any[]>('/api/v1/conversations')
      if (Array.isArray(data)) {
        if (data.length > 0) {
          const currentSelected = selectedIdRef.current
          // biome-ignore lint/suspicious/noExplicitAny: mapping backend schema
          const mapped: ConversationItem[] = data.map((item: any) => {
            const isSelected = item.id === currentSelected
            return {
              id: item.id,
              contactName: item.contact?.name || item.contact?.phoneNumber || 'Pelanggan WhatsApp',
              contactPhone: item.contact?.phoneNumber,
              // biome-ignore lint/suspicious/noExplicitAny: channel type
              channel: (item.channelType as any) || 'whatsapp',
              lastMessage:
                item.lastMessage ||
                (item.lastMessageAt ? 'Pesan baru diterima' : 'Percakapan baru'),
              lastMessageTimestamp: item.lastMessageAt
                ? new Date(item.lastMessageAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Baru saja',
              unreadCount: isSelected ? 0 : item.unreadCount || 0,
              ticket: item.activeTicket
                ? {
                    id: item.activeTicket.id,
                    ticketNumber: String(item.activeTicket.displayId ?? 'T-000'),
                    status: item.activeTicket.status || 'open',
                    priority: item.activeTicket.priority || 'medium',
                    assignedTo: item.activeTicket.assigneeId,
                  }
                : undefined,
            }
          })

          setConversations(mapped)
          setSelectedConversationId((prev) => prev || mapped[0]?.id || null)
        } else {
          setConversations([])
          setSelectedConversationId(null)
        }
      }
    } catch (err) {
      console.error('Failed to load conversations from backend:', err)
    }
  }, [])

  // Fetch messages when conversation is selected
  const fetchMessages = useCallback(
    async (convId?: string) => {
      const targetId = convId || selectedIdRef.current || selectedConversationId
      if (!targetId) return
      try {
        // biome-ignore lint/suspicious/noExplicitAny: backend conversation detail
        const data = await api.get<any>(`/api/v1/conversations/${targetId}`)

        if (data?.contact || data?.activeTicket) {
          setConversations((prev) => {
            const exists = prev.some((c) => c.id === targetId)
            if (exists) {
              return prev.map((c) => {
                if (c.id !== targetId) return c
                return {
                  ...c,
                  contactName: data.contact?.name || data.contact?.phoneNumber || c.contactName,
                  contactPhone: data.contact?.phoneNumber || c.contactPhone,
                  ticket: data.activeTicket
                    ? {
                        id: data.activeTicket.id,
                        ticketNumber: String(data.activeTicket.displayId ?? 'T-000'),
                        status: data.activeTicket.status || 'open',
                        priority: data.activeTicket.priority || 'medium',
                        assignedTo: data.activeTicket.assigneeId,
                      }
                    : c.ticket,
                }
              })
            }
            const newConv: ConversationItem = {
              id: targetId,
              contactName: data.contact?.name || data.contact?.phoneNumber || 'Pelanggan WhatsApp',
              contactPhone: data.contact?.phoneNumber,
              // biome-ignore lint/suspicious/noExplicitAny: channel type
              channel: (data.conversation?.channelType as any) || 'whatsapp',
              lastMessage: data.messages?.[data.messages.length - 1]?.content || 'Percakapan baru',
              lastMessageTimestamp: 'Baru saja',
              unreadCount: 0,
              ticket: data.activeTicket
                ? {
                    id: data.activeTicket.id,
                    ticketNumber: String(data.activeTicket.displayId ?? 'T-000'),
                    status: data.activeTicket.status || 'open',
                    priority: data.activeTicket.priority || 'medium',
                    assignedTo: data.activeTicket.assigneeId,
                  }
                : undefined,
            }
            return [newConv, ...prev]
          })
        }

        if (data?.activeTicket?.internalNote) {
          setInternalNote(data.activeTicket.internalNote)
        }

        if (data?.messages && Array.isArray(data.messages)) {
          // biome-ignore lint/suspicious/noExplicitAny: message mapping
          const mappedMsgs: TimelineMessage[] = data.messages.map((m: any) => {
            const isCustomer = m.senderType === 'contact' || m.senderType === 'customer'
            const msgType: MessageType =
              m.messageType === 'activity' || m.senderType === 'system'
                ? 'activity'
                : isCustomer
                  ? 'incoming'
                  : 'outgoing'

            return {
              id: m.id,
              conversationId: m.conversationId,
              ticketId: m.ticketId,
              ticketDisplayId: m.ticketDisplayId,
              senderId: m.senderId || (isCustomer ? 'customer' : user.id),
              senderType: isCustomer ? 'contact' : 'user',
              senderName: isCustomer
                ? data.contact?.name || data.contact?.phoneNumber || 'Pelanggan'
                : user.name,
              messageType: msgType,
              contentType: (m.contentType as ContentType) || 'text',
              content: m.content || '',
              timestamp: m.createdAt
                ? new Date(m.createdAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Baru saja',
              dateGroup: formatDateGroup(m.createdAt),
              status: m.status || (isCustomer ? 'delivered' : 'read'),
              isEdited: Boolean(m.contentAttributes?.isEdited || m.isEdited),
              editedAt: m.contentAttributes?.editedAt || m.editedAt,
              editHistory: m.contentAttributes?.editHistory || m.editHistory || [],
            }
          })
          setMessagesMap((prev) => {
            if (areMessagesIdentical(prev[targetId], mappedMsgs)) {
              return prev
            }
            return {
              ...prev,
              [targetId]: mappedMsgs,
            }
          })
        }
      } catch {
        // preserve memory messages on error
      }
    },
    [selectedConversationId, user.id, user.name],
  )

  // Real-time SSE updates without page refresh
  const realtime = useRealtimeStream({
    token: api.getToken() || 'valid-access-token',
    onMessageCreated: (rawEvent) => {
      // biome-ignore lint/suspicious/noExplicitAny: event normalization
      const anyEvt = rawEvent as any
      const rawMsg = anyEvt.message || anyEvt
      const convId = anyEvt.conversation?.id || anyEvt.conversationId || rawMsg.conversationId

      const isCustomer =
        rawMsg.senderType === 'contact' ||
        rawMsg.senderType === 'customer' ||
        anyEvt.senderType === 'contact' ||
        anyEvt.contact !== undefined ||
        rawMsg.messageType === 'incoming'

      const msgType: MessageType =
        rawMsg.messageType === 'activity' || rawMsg.senderType === 'system'
          ? 'activity'
          : isCustomer
            ? 'incoming'
            : 'outgoing'

      const rawTime = rawMsg.createdAt || anyEvt.timestamp || anyEvt.createdAt
      const timeStr =
        rawTime?.includes('T') && rawTime.includes('Z')
          ? new Date(rawTime).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : rawTime || 'Baru saja'

      const event: MessageCreatedEvent = {
        id: rawMsg.id || anyEvt.id,
        conversationId: convId,
        ticketId: rawMsg.ticketId || anyEvt.ticket?.id,
        ticketDisplayId:
          rawMsg.ticketDisplayId || anyEvt.ticket?.displayId || anyEvt.ticket?.ticketNumber,
        content: rawMsg.content || anyEvt.content || '',
        messageType: msgType,
        contentType: (rawMsg.contentType || anyEvt.contentType || 'text') as ContentType,
        senderId: rawMsg.senderId || anyEvt.contact?.id || anyEvt.senderId,
        senderType: isCustomer ? 'contact' : 'user',
        senderName:
          anyEvt.contact?.name ||
          anyEvt.senderName ||
          (isCustomer ? 'Pelanggan WhatsApp' : user.name),
        timestamp: timeStr,
        status: rawMsg.status || (isCustomer ? 'delivered' : 'sent'),
      }

      setMessagesMap((prev) => applyRealtimeMessage(prev, event))
      fetchConversations()

      // When message arrives for active conversation, immediately sync messages with DB
      if (selectedIdRef.current && selectedIdRef.current === convId) {
        fetchMessages(convId)
      }
    },
    onMessageStatusUpdated: (event) => {
      setMessagesMap((prev) => applyRealtimeMessageStatus(prev, event))
    },
    onMessageEdited: (event) => {
      setMessagesMap((prev) => applyRealtimeMessageEdit(prev, event))
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === event.conversationId) {
            return {
              ...c,
              lastMessage: event.content,
            }
          }
          return c
        }),
      )
    },
    onTicketUpdated: (rawEvt) => {
      // biome-ignore lint/suspicious/noExplicitAny: event normalization
      const anyEvt = rawEvt as any
      const t = anyEvt?.ticket || anyEvt
      if (!t) return
      const event: TicketUpdatedEvent = {
        id: t.id,
        ticketNumber: String(t.ticketNumber ?? t.displayId ?? ''),
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo ?? t.assigneeId ?? null,
        internalNote: t.internalNote ?? null,
        updatedAt: t.updatedAt,
      }
      setConversations((prev) => applyRealtimeTicket(prev, event))
      if (
        selectedConversationId &&
        event.internalNote !== undefined &&
        event.internalNote !== null
      ) {
        setInternalNote(event.internalNote)
      }
    },
  })

  // Keep conversations list fresh
  useEffect(() => {
    fetchConversations()
    const timer = setInterval(() => {
      fetchConversations()
    }, 5000)
    return () => clearInterval(timer)
  }, [fetchConversations])

  // Fetch messages when conversation is selected, with safety background polling
  useEffect(() => {
    if (!selectedConversationId) return
    setConversations((prev) =>
      prev.map((c) => (c.id === selectedConversationId ? { ...c, unreadCount: 0 } : c)),
    )
    fetchMessages(selectedConversationId)
    const timer = setInterval(() => {
      fetchMessages(selectedConversationId)
    }, 3000)
    return () => clearInterval(timer)
  }, [selectedConversationId, fetchMessages])

  // Filter conversations
  const filteredConversations = useMemo(
    () =>
      filterConversations(conversations, {
        activeChannelFilter,
        searchQuery,
        activeFilter,
        userId: user.id,
      }),
    [conversations, activeChannelFilter, searchQuery, activeFilter, user.id],
  )

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId)
  const currentMessages = selectedConversationId ? messagesMap[selectedConversationId] || [] : []

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !selectedConversationId) return

    const now = new Date()
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    const tempId = `temp-${Date.now()}`

    const optimisticMsg: TimelineMessage = {
      id: tempId,
      conversationId: selectedConversationId,
      senderId: user.id,
      senderType: 'user',
      senderName: user.name,
      messageType: 'outgoing',
      contentType: 'text',
      content: text.trim(),
      timestamp: timeStr,
      dateGroup: 'HARI INI',
      status: 'sending',
    }

    // Optimistic UI update
    setMessagesMap((prev) => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), optimisticMsg],
    }))

    // Update last message in conversation list
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              lastMessage: text.trim(),
              lastMessageTimestamp: timeStr,
              unreadCount: 0,
            }
          : c,
      ),
    )

    try {
      // biome-ignore lint/suspicious/noExplicitAny: backend message response
      const data = await api.post<any>(`/api/v1/conversations/${selectedConversationId}/messages`, {
        content: text.trim(),
        contentType: 'text',
      })

      const m = data?.message
      if (m) {
        const sentMsg: TimelineMessage = {
          id: m.id || tempId,
          conversationId: selectedConversationId,
          senderId: m.senderId || user.id,
          senderType: 'user',
          senderName: user.name,
          messageType: 'outgoing',
          contentType: (m.contentType as ContentType) || 'text',
          content: m.content || text.trim(),
          timestamp: m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : timeStr,
          dateGroup: 'HARI INI',
          status: m.status || 'sent',
        }

        setMessagesMap((prev) => ({
          ...prev,
          [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
            msg.id === tempId ? sentMsg : msg,
          ),
        }))
      } else {
        setMessagesMap((prev) => ({
          ...prev,
          [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
            msg.id === tempId ? { ...msg, status: 'failed' } : msg,
          ),
        }))
      }
    } catch (err) {
      console.error('Failed to send message:', err)
      setMessagesMap((prev) => ({
        ...prev,
        [selectedConversationId]: (prev[selectedConversationId] || []).map((msg) =>
          msg.id === tempId ? { ...msg, status: 'failed' } : msg,
        ),
      }))
    }
  }

  const handleResolveTicket = async () => {
    if (!selectedConversationId) return
    const currentConv = conversations.find((c) => c.id === selectedConversationId)
    const activeTicket = currentConv?.ticket
    if (!activeTicket?.id) return

    const nextStatus = activeTicket.status === 'resolved' ? 'open' : 'resolved'

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                status: nextStatus,
              },
            }
          : c,
      ),
    )

    try {
      await api.patch(`/api/v1/tickets/${activeTicket.id}/status`, { status: nextStatus })
    } catch {
      fetchConversations()
    }
  }

  const handleAssignTicket = async () => {
    if (!selectedConversationId) return
    const currentConv = conversations.find((c) => c.id === selectedConversationId)
    const activeTicket = currentConv?.ticket
    if (!activeTicket?.id) return

    const isAssignedToMe = activeTicket.assignedTo === user.id
    const nextAssigneeId = isAssignedToMe ? null : user.id

    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId && c.ticket
          ? {
              ...c,
              ticket: {
                ...c.ticket,
                assignedTo: nextAssigneeId || undefined,
              },
            }
          : c,
      ),
    )

    try {
      await api.patch(`/api/v1/tickets/${activeTicket.id}/assignee`, { assigneeId: nextAssigneeId })
    } catch {
      fetchConversations()
    }
  }

  const handleSelectConversation = useCallback(
    (id: string | null) => {
      setSelectedConversationId(id)
      selectedIdRef.current = id
      if (!id) return
      // Clear unread in local state
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))

      api.post(`/api/v1/conversations/${id}/read`).catch(() => {})
      fetchMessages(id)
    },
    [fetchMessages],
  )

  return {
    conversations,
    setConversations,
    messagesMap,
    setMessagesMap,
    selectedConversationId,
    setSelectedConversationId,
    isDrawerOpen,
    setIsDrawerOpen,
    activeTab,
    setActiveTab,
    activeChannelFilter,
    setActiveChannelFilter,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    internalNote,
    setInternalNote,
    filteredConversations,
    selectedConversation,
    currentMessages,
    fetchConversations,
    handleSendMessage,
    handleResolveTicket,
    handleAssignTicket,
    handleSelectConversation,
    realtime,
  }
}
