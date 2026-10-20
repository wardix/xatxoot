import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { RealtimeStreamClient, applyRealtimeMessageEdit } from '../../hooks/useRealtimeStream'
import { ChatBubble } from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('WhatsApp Edited Message UI & Realtime (TDD RED)', () => {
  it('ChatBubble should render (diedit) indicator and popover history when message is edited', () => {
    const editedMsg: TimelineMessage = {
      id: 'msg-edited-1',
      conversationId: 'conv-1',
      content: 'Teks yang sudah diedit',
      messageType: 'incoming',
      contentType: 'text',
      timestamp: '10:15',
      isEdited: true,
      editedAt: '2026-10-20T10:15:00.000Z',
      editHistory: [
        {
          previousContent: 'Teks lama yang salah',
          editedAt: '2026-10-20T10:15:00.000Z',
        },
      ],
    }

    const html = renderToStaticMarkup(<ChatBubble message={editedMsg} />)

    expect(html).toContain('data-testid="message-edited-badge"')
    expect(html).toContain('(diedit)')
    expect(html).toContain('Teks yang sudah diedit')
    expect(html).toContain('data-testid="edit-history-popover"')
    expect(html).toContain('Teks lama yang salah')
  })

  it('applyRealtimeMessageEdit should update message content and audit history in-place in messagesMap', () => {
    const initialMap: Record<string, TimelineMessage[]> = {
      'conv-123': [
        {
          id: 'msg-1',
          conversationId: 'conv-123',
          content: 'Alamat pengiriman: Menteng',
          messageType: 'incoming',
          contentType: 'text',
          timestamp: '09:00',
        },
      ],
    }

    const updatedMap = applyRealtimeMessageEdit(initialMap, {
      id: 'msg-1',
      conversationId: 'conv-123',
      content: 'Alamat pengiriman: Kebayoran Baru',
      editedAt: '2026-10-20T09:10:00.000Z',
      contentAttributes: {
        isEdited: true,
        editedAt: '2026-10-20T09:10:00.000Z',
        editHistory: [
          {
            previousContent: 'Alamat pengiriman: Menteng',
            editedAt: '2026-10-20T09:10:00.000Z',
          },
        ],
      },
    })

    const messages = updatedMap['conv-123']
    expect(messages).toHaveLength(1)
    expect(messages[0].content).toBe('Alamat pengiriman: Kebayoran Baru')
    expect(messages[0].isEdited).toBe(true)
    expect(messages[0].editHistory?.length).toBe(1)
    expect(messages[0].editHistory?.[0].previousContent).toBe('Alamat pengiriman: Menteng')
  })

  it('RealtimeStreamClient should invoke onMessageEdited callback when message.edited event arrives', () => {
    let capturedEvent: unknown = null

    // biome-ignore lint/suspicious/noExplicitAny: mock EventSource
    const mockListeners: Record<string, (e: any) => void> = {}

    // Mock global EventSource
    const originalEventSource = globalThis.EventSource
    // biome-ignore lint/suspicious/noExplicitAny: mock implementation
    ;(globalThis as any).EventSource = class MockEventSource {
      url: string
      readyState = 1
      constructor(url: string) {
        this.url = url
      }
      addEventListener(event: string, cb: (e: unknown) => void) {
        mockListeners[event] = cb
      }
      removeEventListener() {}
      close() {}
    }

    try {
      const client = new RealtimeStreamClient({
        baseUrl: 'http://localhost:8800',
        autoConnect: true,
        onMessageEdited: (data) => {
          capturedEvent = data
        },
      })

      expect(typeof mockListeners['message.edited']).toBe('function')

      mockListeners['message.edited']({
        data: JSON.stringify({
          id: 'msg-99',
          conversationId: 'conv-99',
          content: 'Pesan sudah diedit secara realtime',
          editedAt: '2026-10-20T09:15:00.000Z',
        }),
      })

      // biome-ignore lint/suspicious/noExplicitAny: event check
      expect((capturedEvent as any)?.content).toBe('Pesan sudah diedit secara realtime')
      client.disconnect()
    } finally {
      globalThis.EventSource = originalEventSource
    }
  })
})
