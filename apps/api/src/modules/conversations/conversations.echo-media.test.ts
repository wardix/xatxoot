import { describe, expect, it } from 'bun:test'
import { conversationService } from './conversations.service'

describe('WhatsApp Echo Outgoing Media Synchronization (Issue #304 - TDD RED)', () => {
  const inboxId = '22222222-2222-4222-a222-222222222222'
  const sourceId = '628123456789'
  const senderPhone = '+628123456789'

  it('handleOutboundEcho should preserve mediaUrl in contentAttributes and populate attachments for image echo', async () => {
    const mediaUrl = 'http://localhost:8801/media/echo_test_photo.jpg'
    const result = await conversationService.handleOutboundEcho({
      inboxId,
      sourceId,
      senderPhone,
      senderName: 'Budi Santoso',
      content: 'Foto dokumentasi fisik dari HP',
      externalId: 'WAM_ECHO_MEDIA_001',
      messageType: 'image',
      contentType: 'image',
      mediaUrl,
    })

    expect(result.message).toBeDefined()
    expect(result.message.contentType).toBe('image')

    // 1. contentAttributes must store mediaUrl
    const attrs = result.message.contentAttributes as Record<string, unknown>
    expect(attrs.mediaUrl).toBe(mediaUrl)

    // 2. attachments array must be populated
    expect(result.message.attachments).toBeDefined()
    expect(result.message.attachments?.length).toBe(1)
    expect(result.message.attachments?.[0].fileUrl).toBe(mediaUrl)
    expect(result.message.attachments?.[0].fileType).toBe('image/jpeg')

    // 3. Conversation history retrieval (getConversationById) must return mediaUrl and attachments
    const detail = await conversationService.getConversationById(result.conversation.id)
    expect(detail).not.toBeNull()
    const foundMsg = detail?.messages.find((m) => m.id === result.message.id)
    expect(foundMsg).toBeDefined()
    expect(foundMsg?.mediaUrl).toBe(mediaUrl)
    expect(foundMsg?.attachments).toBeDefined()
    expect(foundMsg?.attachments?.length).toBe(1)
  })

  it('handleOutboundEcho should support document attachment for echo message', async () => {
    const docUrl = 'http://localhost:8801/media/laporan_penjualan.pdf'
    const result = await conversationService.handleOutboundEcho({
      inboxId,
      sourceId,
      senderPhone,
      senderName: 'Budi Santoso',
      content: 'Laporan Penjualan Harian',
      externalId: 'WAM_ECHO_MEDIA_002',
      messageType: 'document',
      contentType: 'document',
      mediaUrl: docUrl,
    })

    expect(result.message.contentType).toBe('document')
    const attrs = result.message.contentAttributes as Record<string, unknown>
    expect(attrs.mediaUrl).toBe(docUrl)
    expect(result.message.attachments?.length).toBe(1)
    expect(result.message.attachments?.[0].fileUrl).toBe(docUrl)
  })
})
