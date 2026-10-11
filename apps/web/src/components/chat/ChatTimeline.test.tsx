import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ChatBubble,
  ChatTimeline,
  DateSeparatorPill,
  DeliveryStatusTick,
  formatWhatsAppText,
} from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('Chat Timeline Component (Task 1.25 - apps/web)', () => {
  describe('WhatsApp Text Formatter', () => {
    it('should format bold (*text*), italic (_text_), strikethrough (~text~), and monospace (```code```)', () => {
      expect(formatWhatsAppText('Halo *Budi*')).toContain('<strong>Budi</strong>')
      expect(formatWhatsAppText('Ini _miring_')).toContain('<em>miring</em>')
      expect(formatWhatsAppText('Harga ~100000~')).toContain('<del>100000</del>')
      expect(formatWhatsAppText('Kode ```PROMO2026```')).toContain(
        '<code class="bg-black/10 px-1 py-0.5 rounded font-mono text-xs">PROMO2026</code>',
      )
    })

    it('should escape HTML tags to prevent XSS injection', () => {
      const unsafe = '<script>alert("xss")</script>'
      const formatted = formatWhatsAppText(unsafe)
      expect(formatted).not.toContain('<script>')
      expect(formatted).toContain('&lt;script&gt;')
    })
  })

  describe('DeliveryStatusTick', () => {
    it('should render clock icon for pending status', () => {
      const html = renderToStaticMarkup(<DeliveryStatusTick status="pending" />)
      expect(html).toContain('data-testid="delivery-status"')
      expect(html).toContain('data-status="pending"')
      expect(html).toContain('title="Menunggu pengiriman"')
    })

    it('should render single grey check for sent status', () => {
      const html = renderToStaticMarkup(<DeliveryStatusTick status="sent" />)
      expect(html).toContain('data-status="sent"')
      expect(html).toContain('title="Terkirim"')
    })

    it('should render double grey check for delivered status', () => {
      const html = renderToStaticMarkup(<DeliveryStatusTick status="delivered" />)
      expect(html).toContain('data-status="delivered"')
      expect(html).toContain('title="Diterima"')
    })

    it('should render double blue check (#53bdeb) for read status', () => {
      const html = renderToStaticMarkup(<DeliveryStatusTick status="read" />)
      expect(html).toContain('data-status="read"')
      expect(html).toContain('title="Dibaca"')
      expect(html).toContain('text-[#53bdeb]')
    })

    it('should render red error icon for failed status', () => {
      const html = renderToStaticMarkup(<DeliveryStatusTick status="failed" />)
      expect(html).toContain('data-status="failed"')
      expect(html).toContain('title="Gagal terkirim"')
      expect(html).toContain('text-rose-500')
    })
  })

  describe('DateSeparatorPill & ActivityPill', () => {
    it('should render centered floating date separator pill', () => {
      const html = renderToStaticMarkup(<DateSeparatorPill dateText="HARI INI" />)
      expect(html).toContain('data-testid="date-separator-pill"')
      expect(html).toContain('HARI INI')
      expect(html).toContain('rounded-lg')
    })
  })

  describe('ChatBubble', () => {
    const mockIncoming: TimelineMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'contact-01',
      senderType: 'contact',
      senderName: 'Budi Santoso',
      messageType: 'incoming',
      contentType: 'text',
      content: 'Halo kak, apakah ada *stok* warna hitam?',
      timestamp: '14:20',
      status: 'read',
    }

    const mockOutgoing: TimelineMessage = {
      id: 'msg-2',
      conversationId: 'conv-1',
      senderId: 'agent-01',
      senderType: 'user',
      senderName: 'Sarah CS',
      messageType: 'outgoing',
      contentType: 'text',
      content: 'Halo kak Budi, stok warna hitam _tersedia_ siap kirim!',
      timestamp: '14:21',
      status: 'read',
    }

    const mockActivity: TimelineMessage = {
      id: 'msg-3',
      conversationId: 'conv-1',
      messageType: 'activity',
      contentType: 'text',
      content: 'Tiket #T-101 dibuka secara otomatis oleh sistem',
      timestamp: '14:20',
    }

    it('should render incoming message with white background, left tail, and no delivery tick', () => {
      const html = renderToStaticMarkup(<ChatBubble message={mockIncoming} />)
      expect(html).toContain('data-testid="chat-bubble-incoming"')
      expect(html).toContain('bg-[#ffffff]')
      expect(html).toContain('data-tail="incoming"')
      expect(html).toContain('14:20')
      expect(html).toContain('<strong>stok</strong>')
      // Incoming messages do not show outgoing delivery ticks
      expect(html).not.toContain('data-testid="delivery-status"')
    })

    it('should render outgoing message with pastel green background, right tail, and double check tick', () => {
      const html = renderToStaticMarkup(<ChatBubble message={mockOutgoing} />)
      expect(html).toContain('data-testid="chat-bubble-outgoing"')
      expect(html).toContain('bg-[#d9fdd3]')
      expect(html).toContain('data-tail="outgoing"')
      expect(html).toContain('14:21')
      expect(html).toContain('<em>tersedia</em>')
      // Outgoing message shows read delivery tick
      expect(html).toContain('data-testid="delivery-status"')
      expect(html).toContain('data-status="read"')
    })

    it('should render activity message as a centered activity pill', () => {
      const html = renderToStaticMarkup(<ChatBubble message={mockActivity} />)
      expect(html).toContain('data-testid="activity-pill"')
      expect(html).toContain('Tiket #T-101 dibuka secara otomatis')
      expect(html).not.toContain('data-testid="chat-bubble-incoming"')
      expect(html).not.toContain('data-testid="chat-bubble-outgoing"')
    })

    it('should render media attachment (image / document) properly in bubble', () => {
      const mockImageMsg: TimelineMessage = {
        id: 'msg-4',
        conversationId: 'conv-1',
        senderId: 'contact-01',
        senderType: 'contact',
        messageType: 'incoming',
        contentType: 'image',
        content: 'Bukti pembayaran',
        mediaUrl: 'https://example.com/receipt.jpg',
        timestamp: '14:22',
        status: 'read',
      }

      const html = renderToStaticMarkup(<ChatBubble message={mockImageMsg} />)
      expect(html).toContain('data-testid="chat-bubble-incoming"')
      expect(html).toContain('data-testid="bubble-media-image"')
      expect(html).toContain('src="https://example.com/receipt.jpg"')
      expect(html).toContain('Bukti pembayaran')
    })
  })

  describe('ChatTimeline Full Component', () => {
    const mockMessages: TimelineMessage[] = [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'contact-01',
        senderType: 'contact',
        senderName: 'Budi Santoso',
        messageType: 'incoming',
        contentType: 'text',
        content: 'Halo CS, apakah pesanan #ORD-987 sudah dikirim?',
        timestamp: '10:00',
        dateGroup: 'HARI INI',
        status: 'read',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        messageType: 'activity',
        contentType: 'text',
        content: 'Tiket #T-101 dibuka otomatis.',
        timestamp: '10:00',
        dateGroup: 'HARI INI',
      },
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        senderId: 'agent-01',
        senderType: 'user',
        senderName: 'Sarah CS',
        messageType: 'outgoing',
        contentType: 'text',
        content: 'Halo kak Budi, pesanan sedang disiapkan di gudang ya!',
        timestamp: '10:05',
        dateGroup: 'HARI INI',
        status: 'delivered',
      },
    ]

    it('should render date separator, bubbles with tails, and delivery status in sequence', () => {
      const html = renderToStaticMarkup(
        <ChatTimeline messages={mockMessages} onRetryMessage={() => {}} />,
      )

      expect(html).toContain('data-testid="chat-timeline"')
      expect(html).toContain('data-testid="date-separator-pill"')
      expect(html).toContain('HARI INI')
      expect(html).toContain('data-testid="chat-bubble-incoming"')
      expect(html).toContain('data-testid="activity-pill"')
      expect(html).toContain('data-testid="chat-bubble-outgoing"')
      expect(html).toContain('data-status="delivered"')
    })

    it('should NEVER render internal note bubbles in the conversation thread', () => {
      const html = renderToStaticMarkup(<ChatTimeline messages={mockMessages} />)

      // Strict PRD architecture rule: Internal note must NOT exist as a message bubble
      expect(html).not.toContain('internal-note-bubble')
      expect(html).not.toContain('Sticky Internal Note')
    })
  })
})
