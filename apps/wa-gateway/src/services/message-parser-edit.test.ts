import { describe, expect, it } from 'bun:test'
import { extractInboundMessage } from './message-parser'

describe('WhatsApp Edited Message Parser (TDD RED)', () => {
  const channelId = '11111111-1111-4111-a111-111111111111'
  const inboxId = '22222222-2222-4222-a222-222222222222'

  it('extractInboundMessage should parse Baileys protocolMessage edit (type 14) with conversation text', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'EDIT_CONTAINER_ID_001',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: false,
            id: 'ORIGINAL_MSG_ID_001',
          },
          type: 14,
          editedMessage: {
            conversation: 'Teks baru yang sudah direvisi',
          },
          timestampMs: 1713000500000,
        },
      },
      messageTimestamp: 1713000500,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId,
      inboxId,
    })

    expect(result).not.toBeNull()
    expect(result?.isEdit).toBe(true)
    expect(result?.targetExternalId).toBe('ORIGINAL_MSG_ID_001')
    expect(result?.content).toBe('Teks baru yang sudah direvisi')
    expect(result?.newContent).toBe('Teks baru yang sudah direvisi')
    expect(result?.externalMessageId).toBe('EDIT_CONTAINER_ID_001')
  })

  it('extractInboundMessage should parse editedMessage containing extendedTextMessage', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'EDIT_CONTAINER_ID_002',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: false,
            id: 'ORIGINAL_MSG_ID_002',
          },
          type: 14,
          editedMessage: {
            extendedTextMessage: {
              text: 'Revisi alamat pengiriman: Jl. Sudirman No. 45',
            },
          },
        },
      },
      messageTimestamp: 1713000600,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId,
      inboxId,
    })

    expect(result).not.toBeNull()
    expect(result?.isEdit).toBe(true)
    expect(result?.targetExternalId).toBe('ORIGINAL_MSG_ID_002')
    expect(result?.content).toBe('Revisi alamat pengiriman: Jl. Sudirman No. 45')
    expect(result?.newContent).toBe('Revisi alamat pengiriman: Jl. Sudirman No. 45')
  })

  it('extractInboundMessage should unwrap ephemeralMessage wrapping protocolMessage edit', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: false,
        id: 'EDIT_CONTAINER_ID_003',
      },
      message: {
        ephemeralMessage: {
          message: {
            protocolMessage: {
              key: {
                remoteJid: '628123456789@s.whatsapp.net',
                fromMe: false,
                id: 'ORIGINAL_MSG_ID_003',
              },
              type: 14,
              editedMessage: {
                conversation: 'Pesan ephemeral yang diedit',
              },
            },
          },
        },
      },
      messageTimestamp: 1713000700,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId,
      inboxId,
    })

    expect(result).not.toBeNull()
    expect(result?.isEdit).toBe(true)
    expect(result?.targetExternalId).toBe('ORIGINAL_MSG_ID_003')
    expect(result?.content).toBe('Pesan ephemeral yang diedit')
  })

  it('extractInboundMessage should handle echo outgoing edited message when isEcho is true', () => {
    const rawMsg = {
      key: {
        remoteJid: '628123456789@s.whatsapp.net',
        fromMe: true,
        id: 'EDIT_CONTAINER_ID_ECHO',
      },
      message: {
        protocolMessage: {
          key: {
            remoteJid: '628123456789@s.whatsapp.net',
            fromMe: true,
            id: 'ORIGINAL_OUTGOING_ID',
          },
          type: 14,
          editedMessage: {
            conversation: 'Klarifikasi admin dari HP fisik',
          },
        },
      },
      messageTimestamp: 1713000800,
    }

    const result = extractInboundMessage(rawMsg, {
      channelId,
      inboxId,
      isEcho: true,
    })

    expect(result).not.toBeNull()
    expect(result?.isEdit).toBe(true)
    expect(result?.isEcho).toBe(true)
    expect(result?.targetExternalId).toBe('ORIGINAL_OUTGOING_ID')
    expect(result?.content).toBe('Klarifikasi admin dari HP fisik')
  })
})
