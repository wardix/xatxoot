import { beforeEach, describe, expect, it } from 'bun:test'
import {
  BaileysConnectionManager,
  REDIS_CHANNEL_WA_SESSION_QR,
  RedisEventPublisher,
  type WaSessionQrEvent,
  WaSessionQrEventSchema,
} from '../apps/wa-gateway/src/index'

describe('WhatsApp Gateway QR Code Event to Redis Pub/Sub (Task 1.12)', () => {
  const channelId = '11111111-1111-4111-a111-111111111111'
  const inboxId = '22222222-2222-4222-a222-222222222222'
  const sampleQrCode = '2@ABC123MockBaileysRawQrCodeString=='

  describe('Constants and Schema Validation', () => {
    it('should have correct Redis Pub/Sub channel name wa:session:qr per docs/EVENTS.md', () => {
      expect(REDIS_CHANNEL_WA_SESSION_QR).toBe('wa:session:qr')
    })

    it('should validate valid WaSessionQrEvent schema', () => {
      const validEvent: WaSessionQrEvent = {
        channelId,
        inboxId,
        qrCode: sampleQrCode,
        expiresInSeconds: 60,
        timestamp: new Date().toISOString(),
      }

      const parsed = WaSessionQrEventSchema.safeParse(validEvent)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.channelId).toBe(channelId)
        expect(parsed.data.inboxId).toBe(inboxId)
        expect(parsed.data.qrCode).toBe(sampleQrCode)
        expect(parsed.data.expiresInSeconds).toBe(60)
      }
    })

    it('should reject invalid WaSessionQrEvent with missing fields or non-uuid ids', () => {
      const invalidEvent = {
        channelId: 'not-a-uuid',
        inboxId,
        qrCode: sampleQrCode,
      }

      const parsed = WaSessionQrEventSchema.safeParse(invalidEvent)
      expect(parsed.success).toBe(false)
    })
  })

  describe('Redis Event Publisher', () => {
    it('should publish QR event payload to wa:session:qr channel via Redis client', async () => {
      const publishedMessages: { channel: string; message: string }[] = []

      const mockRedisClient = {
        publish: async (channel: string, message: string) => {
          publishedMessages.push({ channel, message })
          return 1
        },
      }

      const publisher = new RedisEventPublisher({
        redisClient: mockRedisClient,
      })

      const event: WaSessionQrEvent = {
        channelId,
        inboxId,
        qrCode: sampleQrCode,
        expiresInSeconds: 60,
        timestamp: new Date().toISOString(),
      }

      const result = await publisher.publishSessionQr(event)
      expect(result).toBe(1)
      expect(publishedMessages.length).toBe(1)
      expect(publishedMessages[0].channel).toBe('wa:session:qr')

      const parsedBody = JSON.parse(publishedMessages[0].message)
      expect(parsedBody.channelId).toBe(channelId)
      expect(parsedBody.inboxId).toBe(inboxId)
      expect(parsedBody.qrCode).toBe(sampleQrCode)
      expect(parsedBody.expiresInSeconds).toBe(60)
    })

    it('should throw error when publishing invalid QR event payload', async () => {
      const mockRedisClient = {
        publish: async () => 1,
      }

      const publisher = new RedisEventPublisher({
        redisClient: mockRedisClient,
      })

      const invalidEvent = {
        channelId: 'invalid-id',
        inboxId: 'invalid-id',
        qrCode: '',
      } as unknown as WaSessionQrEvent

      expect(publisher.publishSessionQr(invalidEvent)).rejects.toThrow()
    })
  })

  describe('Baileys Session QR Event Integration', () => {
    let publishedEvents: { channel: string; data: WaSessionQrEvent }[] = []
    let mockPublisher: RedisEventPublisher

    beforeEach(() => {
      publishedEvents = []
      const mockRedisClient = {
        publish: async (channel: string, message: string) => {
          publishedEvents.push({ channel, data: JSON.parse(message) })
          return 1
        },
      }
      mockPublisher = new RedisEventPublisher({
        redisClient: mockRedisClient,
      })
    })

    it('should automatically publish QR event to Redis when session emits QR code', async () => {
      const manager = new BaileysConnectionManager()
      const sessionId = 'session_qr_test_1'

      const session = await manager.createSession({
        sessionId,
        channelId,
        inboxId,
        redisPublisher: mockPublisher,
      })

      expect(session.channelId).toBe(channelId)
      expect(session.inboxId).toBe(inboxId)

      // Emit QR code from Baileys socket
      await session.emitQr(sampleQrCode)

      expect(publishedEvents.length).toBe(1)
      expect(publishedEvents[0].channel).toBe('wa:session:qr')
      expect(publishedEvents[0].data.channelId).toBe(channelId)
      expect(publishedEvents[0].data.inboxId).toBe(inboxId)
      expect(publishedEvents[0].data.qrCode).toBe(sampleQrCode)
      expect(publishedEvents[0].data.expiresInSeconds).toBe(60)
      expect(publishedEvents[0].data.timestamp).toBeDefined()
    })

    it('should publish new event each time QR code regenerates', async () => {
      const manager = new BaileysConnectionManager()
      const sessionId = 'session_qr_test_2'

      const session = await manager.createSession({
        sessionId,
        channelId,
        inboxId,
        redisPublisher: mockPublisher,
      })

      // Emit first QR
      await session.emitQr('qr_code_cycle_1')
      // Emit second QR after 20 seconds
      await session.emitQr('qr_code_cycle_2')

      expect(publishedEvents.length).toBe(2)
      expect(publishedEvents[0].data.qrCode).toBe('qr_code_cycle_1')
      expect(publishedEvents[1].data.qrCode).toBe('qr_code_cycle_2')
    })
  })
})
