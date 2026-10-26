import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatBubble } from './ChatTimeline'
import type { TimelineMessage } from './types'

describe('WhatsApp Echo Outgoing Media ChatBubble Rendering (Issue #304 - TDD RED)', () => {
  it('should render image preview (data-testid="bubble-media-image") for echo outgoing message with mediaUrl', () => {
    const echoMessage: TimelineMessage = {
      id: 'msg-echo-media-1',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'image',
      content: 'Foto dari HP agen',
      mediaUrl: 'http://localhost:8801/media/echo_test.jpg',
      timestamp: '10:30',
      isEcho: true,
      senderName: 'WhatsApp HP',
    }

    const html = renderToStaticMarkup(<ChatBubble message={echoMessage} />)

    expect(html).toContain('data-testid="bubble-media-image"')
    expect(html).toContain('src="http://localhost:8801/media/echo_test.jpg"')
    expect(html).toContain('Foto dari HP agen')
  })

  it('should render image preview when mediaUrl is present inside contentAttributes fallback', () => {
    const echoMessageFallback: TimelineMessage = {
      id: 'msg-echo-media-2',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'image',
      content: '',
      timestamp: '10:35',
      isEcho: true,
      senderName: 'WhatsApp HP',
      contentAttributes: {
        mediaUrl: 'http://localhost:8801/media/echo_fallback.jpg',
      },
    }

    const html = renderToStaticMarkup(<ChatBubble message={echoMessageFallback} />)

    expect(html).toContain('data-testid="bubble-media-image"')
    expect(html).toContain('src="http://localhost:8801/media/echo_fallback.jpg"')
  })

  it('should render document preview for echo outgoing document message', () => {
    const echoDocMessage: TimelineMessage = {
      id: 'msg-echo-doc-1',
      conversationId: 'conv-01',
      messageType: 'outgoing',
      contentType: 'document',
      content: 'Laporan Finansial',
      fileName: 'laporan.pdf',
      fileSize: 204800,
      timestamp: '10:40',
      isEcho: true,
      senderName: 'WhatsApp HP',
    }

    const html = renderToStaticMarkup(<ChatBubble message={echoDocMessage} />)

    expect(html).toContain('📄')
    expect(html).toContain('laporan.pdf')
    expect(html).toContain('200 KB')
  })
})
