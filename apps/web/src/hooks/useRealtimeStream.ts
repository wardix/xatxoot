import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MessageCreatedEvent,
  MessageEditedEvent,
  MessageStatusUpdatedEvent,
  RealtimeEventHandler,
  RealtimeStatus,
  RealtimeStreamHookOptions,
  RealtimeStreamOptions,
  TicketUpdatedEvent,
} from './types'

export interface CreateRealtimeUrlOptions {
  baseUrl?: string
  token?: string
}

export function createRealtimeUrl(options: CreateRealtimeUrlOptions = {}): string {
  const { baseUrl, token } = options
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  const path = '/api/v1/realtime/stream'
  const fullPath = cleanBase ? `${cleanBase}${path}` : path

  if (token) {
    return `${fullPath}?token=${encodeURIComponent(token)}`
  }
  return fullPath
}

export class RealtimeStreamClient {
  private status: RealtimeStatus = 'disconnected'
  private eventSource: EventSource | null = null
  private options: RealtimeStreamOptions
  private customListeners = new Map<string, Set<RealtimeEventHandler<unknown>>>()
  private boundEsListeners = new Map<string, (event: unknown) => void>()

  constructor(options: RealtimeStreamOptions = {}) {
    this.options = { ...options }
    if (this.options.autoConnect) {
      this.connect()
    }
  }

  getStatus(): RealtimeStatus {
    return this.status
  }

  private setStatus(newStatus: RealtimeStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus
      this.options.onStatusChange?.(newStatus)
    }
  }

  private parseEventData(event: unknown): unknown {
    if (!event) return event
    const evt = event as { data?: unknown }
    const raw = evt.data !== undefined ? evt.data : event
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch {
        return raw
      }
    }
    return raw
  }

  private registerEsListener(type: string): void {
    if (!this.eventSource || this.boundEsListeners.has(type)) {
      return
    }

    const listener = (event: unknown) => {
      const data = this.parseEventData(event)
      this.emit(type, data)
    }

    this.boundEsListeners.set(type, listener)
    this.eventSource.addEventListener(type, listener as EventListener)
  }

  private emit(type: string, data: unknown): void {
    const listeners = this.customListeners.get(type)
    if (listeners) {
      for (const fn of listeners) {
        fn(data)
      }
    }
  }

  connect(): void {
    if (typeof EventSource === 'undefined') {
      return
    }

    if (this.status === 'connected' || this.status === 'connecting') {
      return
    }

    this.setStatus('connecting')
    const url = createRealtimeUrl({
      baseUrl: this.options.baseUrl,
      token: this.options.token,
    })

    const es = new EventSource(url)
    this.eventSource = es

    es.onopen = () => {
      this.setStatus('connected')
    }

    es.onerror = (err) => {
      this.setStatus('error')
      this.options.onError?.(err)
    }

    // Built-in event listeners
    const handleConnected = (event: unknown) => {
      this.setStatus('connected')
      const data = this.parseEventData(event)
      this.options.onConnected?.(data)
      this.emit('connected', data)
    }

    const handleMessageCreated = (event: unknown) => {
      const data = this.parseEventData(event)
      this.options.onMessageCreated?.(data as MessageCreatedEvent)
      this.emit('message.created', data)
    }

    const handleMessageStatusUpdated = (event: unknown) => {
      const data = this.parseEventData(event)
      this.options.onMessageStatusUpdated?.(data as MessageStatusUpdatedEvent)
      this.emit('message.status_updated', data)
    }

    const handleMessageEdited = (event: unknown) => {
      const data = this.parseEventData(event)
      this.options.onMessageEdited?.(data as MessageEditedEvent)
      this.emit('message.edited', data)
    }

    const handleTicketUpdated = (event: unknown) => {
      const data = this.parseEventData(event)
      this.options.onTicketUpdated?.(data as TicketUpdatedEvent)
      this.emit('ticket.updated', data)
    }

    es.addEventListener('connected', handleConnected as EventListener)
    es.addEventListener('message.created', handleMessageCreated as EventListener)
    es.addEventListener('message.status_updated', handleMessageStatusUpdated as EventListener)
    es.addEventListener('message.edited', handleMessageEdited as EventListener)
    es.addEventListener('ticket.updated', handleTicketUpdated as EventListener)

    this.boundEsListeners.set('connected', handleConnected)
    this.boundEsListeners.set('message.created', handleMessageCreated)
    this.boundEsListeners.set('message.status_updated', handleMessageStatusUpdated)
    this.boundEsListeners.set('message.edited', handleMessageEdited)
    this.boundEsListeners.set('ticket.updated', handleTicketUpdated)

    // Register active custom listeners
    for (const type of this.customListeners.keys()) {
      this.registerEsListener(type)
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      for (const [type, listener] of this.boundEsListeners.entries()) {
        this.eventSource.removeEventListener?.(type, listener as EventListener)
      }
      this.boundEsListeners.clear()
      this.eventSource.close()
      this.eventSource = null
    }
    this.setStatus('disconnected')
  }

  on<T = unknown>(type: string, listener: RealtimeEventHandler<T>): () => void {
    if (!this.customListeners.has(type)) {
      this.customListeners.set(type, new Set())
    }
    this.customListeners.get(type)?.add(listener as RealtimeEventHandler<unknown>)

    if (this.eventSource) {
      this.registerEsListener(type)
    }

    return () => {
      this.off(type, listener)
    }
  }

  off<T = unknown>(type: string, listener: RealtimeEventHandler<T>): void {
    const listeners = this.customListeners.get(type)
    if (listeners) {
      listeners.delete(listener as RealtimeEventHandler<unknown>)
      if (listeners.size === 0) {
        this.customListeners.delete(type)
        const esListener = this.boundEsListeners.get(type)
        if (esListener && this.eventSource) {
          this.eventSource.removeEventListener(type, esListener as EventListener)
          this.boundEsListeners.delete(type)
        }
      }
    }
  }
}

export interface UseRealtimeStreamResult {
  status: RealtimeStatus
  isConnected: boolean
  lastEvent: { type: string; data: unknown } | null
  connect: () => void
  disconnect: () => void
  client: RealtimeStreamClient | null
}

export function useRealtimeStream(
  options: RealtimeStreamHookOptions = {},
): UseRealtimeStreamResult {
  const {
    baseUrl,
    token,
    enabled = true,
    onMessageCreated,
    onMessageStatusUpdated,
    onMessageEdited,
    onTicketUpdated,
    onError,
    onConnected,
  } = options

  const [status, setStatus] = useState<RealtimeStatus>('disconnected')
  const [lastEvent, setLastEvent] = useState<{ type: string; data: unknown } | null>(null)
  const clientRef = useRef<RealtimeStreamClient | null>(null)

  const callbacksRef = useRef({
    onMessageCreated,
    onMessageStatusUpdated,
    onMessageEdited,
    onTicketUpdated,
    onError,
    onConnected,
  })

  useEffect(() => {
    callbacksRef.current = {
      onMessageCreated,
      onMessageStatusUpdated,
      onMessageEdited,
      onTicketUpdated,
      onError,
      onConnected,
    }
  }, [
    onMessageCreated,
    onMessageStatusUpdated,
    onMessageEdited,
    onTicketUpdated,
    onError,
    onConnected,
  ])

  const connect = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = new RealtimeStreamClient({
        baseUrl,
        token,
        autoConnect: false,
        onStatusChange: (newStatus) => {
          setStatus(newStatus)
        },
        onConnected: (data) => {
          setLastEvent({ type: 'connected', data })
          callbacksRef.current.onConnected?.(data)
        },
        onMessageCreated: (event) => {
          setLastEvent({ type: 'message.created', data: event })
          callbacksRef.current.onMessageCreated?.(event)
        },
        onMessageStatusUpdated: (event) => {
          setLastEvent({ type: 'message.status_updated', data: event })
          callbacksRef.current.onMessageStatusUpdated?.(event)
        },
        onMessageEdited: (event) => {
          setLastEvent({ type: 'message.edited', data: event })
          callbacksRef.current.onMessageEdited?.(event)
        },
        onTicketUpdated: (event) => {
          setLastEvent({ type: 'ticket.updated', data: event })
          callbacksRef.current.onTicketUpdated?.(event)
        },
        onError: (err) => {
          callbacksRef.current.onError?.(err)
        },
      })
    }
    clientRef.current.connect()
  }, [baseUrl, token])

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect()
        clientRef.current = null
      }
    }
  }, [enabled, connect, disconnect])

  return {
    status,
    isConnected: status === 'connected',
    lastEvent,
    connect,
    disconnect,
    client: clientRef.current,
  }
}

export function applyRealtimeMessage<T extends { id: string; conversationId: string }>(
  messagesMap: Record<string, T[]>,
  event: MessageCreatedEvent,
): Record<string, T[]> {
  const currentList = messagesMap[event.conversationId] || []
  if (currentList.some((m) => m.id === event.id)) {
    return messagesMap
  }

  const isCustomer =
    event.senderType === 'contact' ||
    event.senderType === 'customer' ||
    event.messageType === 'incoming'

  const msgType: 'incoming' | 'outgoing' | 'activity' =
    event.messageType === 'activity' || event.senderType === 'system'
      ? 'activity'
      : isCustomer
        ? 'incoming'
        : 'outgoing'

  const rawTime = event.timestamp || event.createdAt
  const formattedTime =
    rawTime?.includes('T') && rawTime.includes('Z')
      ? new Date(rawTime).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : rawTime || 'Baru saja'

  const newMsg = {
    id: event.id,
    conversationId: event.conversationId,
    ticketId: event.ticketId,
    ticketDisplayId: event.ticketDisplayId,
    senderId: event.senderId,
    senderType: isCustomer ? 'contact' : 'user',
    senderName: event.senderName,
    messageType: msgType,
    contentType: event.contentType || 'text',
    content: event.content,
    timestamp: formattedTime,
    dateGroup: 'HARI INI',
    status: isCustomer ? event.status || 'delivered' : event.status || 'sent',
  } as unknown as T

  return {
    ...messagesMap,
    [event.conversationId]: [...currentList, newMsg],
  }
}

export function applyRealtimeMessageStatus<
  T extends { id: string; conversationId: string; status?: string },
>(messagesMap: Record<string, T[]>, event: MessageStatusUpdatedEvent): Record<string, T[]> {
  const currentList = messagesMap[event.conversationId]
  if (!currentList) return messagesMap

  let hasChanged = false
  const updatedList = currentList.map((m) => {
    if (m.id === event.id && m.status !== event.status) {
      hasChanged = true
      return { ...m, status: event.status }
    }
    return m
  })

  if (!hasChanged) return messagesMap

  return {
    ...messagesMap,
    [event.conversationId]: updatedList,
  }
}

export function applyRealtimeMessageEdit<
  T extends {
    id: string
    conversationId: string
    content?: string | null
    contentAttributes?: Record<string, unknown>
    isEdited?: boolean
    editedAt?: string
    editHistory?: Array<{ previousContent: string; editedAt: string }>
  },
>(messagesMap: Record<string, T[]>, event: MessageEditedEvent): Record<string, T[]> {
  const currentList = messagesMap[event.conversationId]
  if (!currentList) return messagesMap

  let hasChanged = false
  const updatedList = currentList.map((m) => {
    if (m.id === event.id) {
      hasChanged = true
      const existingHistory =
        event.contentAttributes?.editHistory ||
        (
          m.contentAttributes as
            | { editHistory?: Array<{ previousContent: string; editedAt: string }> }
            | undefined
        )?.editHistory ||
        m.editHistory ||
        []
      return {
        ...m,
        content: event.content,
        isEdited: true,
        editedAt: event.editedAt,
        contentAttributes: {
          ...(m.contentAttributes || {}),
          ...(event.contentAttributes || {}),
          isEdited: true,
          editedAt: event.editedAt,
          editHistory: existingHistory,
        },
        editHistory: existingHistory,
      }
    }
    return m
  })

  if (!hasChanged) return messagesMap

  return {
    ...messagesMap,
    [event.conversationId]: updatedList,
  }
}

export function applyRealtimeTicket<
  T extends { id: string; ticket?: { id: string; [key: string]: unknown } | null },
>(conversations: T[], event: TicketUpdatedEvent): T[] {
  let hasChanged = false
  const updatedList = conversations.map((conv) => {
    if (
      conv.ticket &&
      (conv.ticket.id === event.id || conv.ticket.ticketNumber === event.ticketNumber)
    ) {
      hasChanged = true
      return {
        ...conv,
        ticket: {
          ...conv.ticket,
          status: event.status,
          ...(event.priority ? { priority: event.priority } : {}),
          ...(event.assignedTo !== undefined ? { assignedTo: event.assignedTo } : {}),
          ...(event.internalNote !== undefined ? { internalNote: event.internalNote } : {}),
        },
      }
    }
    return conv
  })

  return hasChanged ? updatedList : conversations
}
