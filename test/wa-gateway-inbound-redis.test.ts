import { beforeEach, describe, expect, it } from 'bun:test'
import {
  BaileysConnectionManager,
  REDIS_CHANNEL_WA_INBOUND_MESSAGE,
  RedisEventPublisher,
  type RedisPublisherClient,
  type WaInboundMessageEvent,
  WaInboundMessageEventSchema,
  extractInboundMessage,
} from '../apps/wa-gateway/src/index'

describe('WhatsApp Gateway Inbound Message Event to Redis Pub/Sub (Task 1.13)', () => {
  const channelId = '33333333-3333-4333-a333-333333333333'
  const inboxId = '44444444-4444-4444-a444-444444444444'
  const senderNumber = '6281234567890'
  const senderJid = `${senderNumber}@s.whatsapp.net`

  describe('Constants and Schema Validation', () => {
    it('should have correct Redis channel name wa:inbound:message per docs/EVENTS.md', () => {
      expect(REDIS_CHANNEL_WA_INBOUND_MESSAGE).toBe('wa:inbound:message')
    })

    it('should validate valid text WaInboundMessageEvent', () => {
      const validEvent: WaInboundMessageEvent = {
        channelId,
        inboxId,
        senderNumber,
        senderName: 'Budi Santoso',
        externalMessageId: 'WTSID_123456789',
        messageType: 'text',
        content: 'Halo, saya ingin menanyakan promo terbaru.',
        timestamp: new Date().toISOString(),
      }

      const parsed = WaInboundMessageEventSchema.safeParse(validEvent)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.senderNumber).toBe(senderNumber)
        expect(parsed.data.content).toBe('Halo, saya ingin menanyakan promo terbaru.')
      }
    })

    it('should validate media WaInboundMessageEvent with attachment metadata', () => {
      const validMediaEvent: WaInboundMessageEvent = {
        channelId,
        inboxId,
        senderNumber,
        externalMessageId: 'WTSID_MEDIA_999',
        messageType: 'image',
        content: 'Foto struk transfer',
        media: {
          mimeType: 'image/jpeg',
          fileName: 'transfer.jpg',
          fileSize: 102400,
        },
        replyToExternalId: 'WTSID_PREVIOUS_111',
        timestamp: new Date().toISOString(),
      }

      const parsed = WaInboundMessageEventSchema.safeParse(validMediaEvent)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.media?.mimeType).toBe('image/jpeg')
        expect(parsed.data.replyToExternalId).toBe('WTSID_PREVIOUS_111')
      }
    })

    it('should reject invalid WaInboundMessageEvent with missing required fields', () => {
      const invalidEvent = {
        channelId: 'not-a-uuid',
        senderNumber,
      }

      const parsed = WaInboundMessageEventSchema.safeParse(invalidEvent)
      expect(parsed.success).toBe(false)
    })
  })

  describe('Redis Event Publisher (publishInboundMessage)', () => {
    it('should publish inbound message event to wa:inbound:message channel', async () => {
      const publishedMessages: { channel: string; message: string }[] = []
      const mockRedisClient: RedisPublisherClient = {
        publish: async (channel: string, message: string) => {
          publishedMessages.push({ channel, message })
          return 1
        },
      }

      const publisher = new RedisEventPublisher({
        redisClient: mockRedisClient,
      })

      const event: WaInboundMessageEvent = {
        channelId,
        inboxId,
        senderNumber,
        senderName: 'Customer Test',
        externalMessageId: 'WTSID_001',
        messageType: 'text',
        content: 'Pesan uji coba',
        timestamp: new Date().toISOString(),
      }

      const res = await publisher.publishInboundMessage(event)
      expect(res).toBe(1)
      expect(publishedMessages.length).toBe(1)
      expect(publishedMessages[0].channel).toBe('wa:inbound:message')

      const parsed = JSON.parse(publishedMessages[0].message)
      expect(parsed.externalMessageId).toBe('WTSID_001')
      expect(parsed.content).toBe('Pesan uji coba')
    })

    it('should throw error when publishing invalid event payload', async () => {
      const mockRedisClient: RedisPublisherClient = {
        publish: async () => 1,
      }
      const publisher = new RedisEventPublisher({ redisClient: mockRedisClient })

      const invalidEvent = {
        channelId: 'invalid-id',
      } as unknown as WaInboundMessageEvent

      expect(publisher.publishInboundMessage(invalidEvent)).rejects.toThrow()
    })
  })

  describe('Baileys WAMessage Parser (extractInboundMessage)', () => {
    const context = { channelId, inboxId }

    it('should parse simple text message (conversation)', () => {
      const rawWam = {
        key: {
          remoteJid: senderJid,
          fromMe: false,
          id: 'WAM_SIMPLE_TEXT_1',
        },
        pushName: 'Budi Santoso',
        message: {
          conversation: 'Halo dari WhatsApp!',
        },
        messageTimestamp: 1728612345,
      }

      const parsed = extractInboundMessage(rawWam, context)
      expect(parsed).not.toBeNull()
      expect(parsed?.senderNumber).toBe(senderNumber)
      expect(parsed?.senderName).toBe('Budi Santoso')
      expect(parsed?.externalMessageId).toBe('WAM_SIMPLE_TEXT_1')
      expect(parsed?.messageType).toBe('text')
      expect(parsed?.content).toBe('Halo dari WhatsApp!')
    })

    it('should parse extended text message with reply quote (contextInfo)', () => {
      const rawWam = {
        key: {
          remoteJid: senderJid,
          fromMe: false,
          id: 'WAM_EXTENDED_TEXT_2',
        },
        pushName: 'Siti Rahma',
        message: {
          extendedTextMessage: {
            text: 'Iya, saya mau yang ini.',
            contextInfo: {
              stanzaId: 'WAM_ORIGINAL_BOT_MESSAGE_0',
            },
          },
        },
        messageTimestamp: 1728612346,
      }

      const parsed = extractInboundMessage(rawWam, context)
      expect(parsed).not.toBeNull()
      expect(parsed?.messageType).toBe('text')
      expect(parsed?.content).toBe('Iya, saya mau yang ini.')
      expect(parsed?.replyToExternalId).toBe('WAM_ORIGINAL_BOT_MESSAGE_0')
    })

    it('should parse image media message with caption and mimeType', () => {
      const rawWam = {
        key: {
          remoteJid: senderJid,
          fromMe: false,
          id: 'WAM_IMAGE_3',
        },
        pushName: 'Pelanggan Foto',
        message: {
          imageMessage: {
            caption: 'Foto struk saya',
            mimetype: 'image/jpeg',
            fileLength: 54321,
          },
        },
        messageTimestamp: 1728612347,
      }

      const parsed = extractInboundMessage(rawWam, context)
      expect(parsed).not.toBeNull()
      expect(parsed?.messageType).toBe('image')
      expect(parsed?.content).toBe('Foto struk saya')
      expect(parsed?.media?.mimeType).toBe('image/jpeg')
      expect(parsed?.media?.fileSize).toBe(54321)
    })

    it('should ignore group messages (@g.us) per FR-WU-12', () => {
      const rawWam = {
        key: {
          remoteJid: '120363021234567890@g.us',
          fromMe: false,
          id: 'WAM_GROUP_MSG',
        },
        message: {
          conversation: 'Pesan dari grup yang harus diabaikan',
        },
      }

      const parsed = extractInboundMessage(rawWam, context)
      expect(parsed).toBeNull()
    })

    it('should ignore status broadcast messages (status@broadcast)', () => {
      const rawWam = {
        key: {
          remoteJid: 'status@broadcast',
          fromMe: false,
          id: 'WAM_STATUS_MSG',
        },
        message: {
          conversation: 'Status update',
        },
      }

      const parsed = extractInboundMessage(rawWam, context)
      expect(parsed).toBeNull()
    })

    it('should ignore outgoing messages sent from device (fromMe: true)', () => {
      const rawWam = {
        key: {
          remoteJid: senderJid,
          fromMe: true,
          id: 'WAM_OUTGOING_ME',
        },
        message: {
          conversation: 'Pesan balasan saya dari HP',
        },
      }

      const parsed = extractInboundMessage(rawWam, context)
      expect(parsed).toBeNull()
    })
  })

  describe('Baileys Session handleInboundMessage Integration', () => {
    let publishedEvents: { channel: string; data: WaInboundMessageEvent }[] = []
    let mockPublisher: RedisEventPublisher

    beforeEach(() => {
      publishedEvents = []
      const mockRedisClient: RedisPublisherClient = {
        publish: async (channel: string, message: string) => {
          publishedEvents.push({ channel, data: JSON.parse(message) })
          return 1
        },
      }
      mockPublisher = new RedisEventPublisher({ redisClient: mockRedisClient })
    })

    it('should automatically publish inbound event to Redis when session receives message', async () => {
      const manager = new BaileysConnectionManager()
      const sessionId = 'session_inbound_test_1'

      let receivedInHandler: WaInboundMessageEvent | null = null

      const session = await manager.createSession({
        sessionId,
        channelId,
        inboxId,
        redisPublisher: mockPublisher,
        handlers: {
          onMessageReceived: (msg) => {
            receivedInHandler = msg as WaInboundMessageEvent
          },
        },
      })

      const rawWam = {
        key: {
          remoteJid: senderJid,
          fromMe: false,
          id: 'WAM_AUTO_PUBLISH_1',
        },
        pushName: 'Pelanggan Setia',
        message: {
          conversation: 'Tolong cek pesanan saya.',
        },
        messageTimestamp: 1728612399,
      }

      const result = await session.handleInboundMessage(rawWam)
      expect(result).not.toBeNull()
      expect(result?.externalMessageId).toBe('WAM_AUTO_PUBLISH_1')

      // Verifikasi event dipublish ke Redis
      expect(publishedEvents.length).toBe(1)
      expect(publishedEvents[0].channel).toBe('wa:inbound:message')
      expect(publishedEvents[0].data.externalMessageId).toBe('WAM_AUTO_PUBLISH_1')
      expect(publishedEvents[0].data.senderNumber).toBe(senderNumber)
      expect(publishedEvents[0].data.content).toBe('Tolong cek pesanan saya.')

      // Verifikasi handler dipanggil
      expect(receivedInHandler).not.toBeNull()
      expect(receivedInHandler?.externalMessageId).toBe('WAM_AUTO_PUBLISH_1')
    })
  })
})
