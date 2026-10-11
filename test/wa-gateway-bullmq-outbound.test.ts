import { beforeEach, describe, expect, it } from 'bun:test'
import {
  BULLMQ_QUEUE_WA_OUTBOUND,
  BaileysConnectionManager,
  JOB_NAME_SEND_MESSAGE,
  JOB_NAME_SEND_REACTION,
  OutboundMessageDispatcher,
  REDIS_CHANNEL_WA_MESSAGE_STATUS,
  RedisEventPublisher,
  type RedisPublisherClient,
  type SendWaMessageJobPayload,
  SendWaMessageJobPayloadSchema,
  type SendWaReactionJobPayload,
  SendWaReactionJobPayloadSchema,
  type WaMessageStatusEvent,
  WaMessageStatusEventSchema,
  processOutboundJob,
} from '../apps/wa-gateway/src/index'

describe('WhatsApp Gateway BullMQ Outbound Worker & Dispatcher (Task 1.14)', () => {
  const channelId = '55555555-5555-4555-a555-555555555555'
  const inboxId = '66666666-6666-4666-a666-666666666666'
  const messageId = '77777777-7777-4777-a777-777777777777'
  const recipientNumber = '6281234567890'

  describe('Constants and Schemas', () => {
    it('should have correct queue and job name constants per docs/EVENTS.md', () => {
      expect(BULLMQ_QUEUE_WA_OUTBOUND).toBe('wa-outbound')
      expect(JOB_NAME_SEND_MESSAGE).toBe('send-message')
      expect(JOB_NAME_SEND_REACTION).toBe('send-reaction')
      expect(REDIS_CHANNEL_WA_MESSAGE_STATUS).toBe('wa:message:status')
    })

    it('should validate SendWaMessageJobPayload schema for text message', () => {
      const validPayload: SendWaMessageJobPayload = {
        jobId: '88888888-8888-4888-a888-888888888888',
        messageId,
        channelId,
        recipientNumber,
        messageType: 'text',
        text: 'Halo pelanggan, terima kasih telah menghubungi kami.',
      }

      const parsed = SendWaMessageJobPayloadSchema.safeParse(validPayload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.recipientNumber).toBe(recipientNumber)
        expect(parsed.data.text).toBe('Halo pelanggan, terima kasih telah menghubungi kami.')
      }
    })

    it('should validate SendWaMessageJobPayload schema for media message with reply quote', () => {
      const validMediaPayload: SendWaMessageJobPayload = {
        jobId: '88888888-8888-4888-a888-888888888888',
        messageId,
        channelId,
        recipientNumber,
        messageType: 'document',
        mediaUrl: 'https://storage.xatxoot.com/invoices/inv-001.pdf',
        fileName: 'Invoice_INV-001.pdf',
        replyToExternalId: 'WAM_CUST_INBOUND_123',
      }

      const parsed = SendWaMessageJobPayloadSchema.safeParse(validMediaPayload)
      expect(parsed.success).toBe(true)
      if (parsed.success) {
        expect(parsed.data.mediaUrl).toBe('https://storage.xatxoot.com/invoices/inv-001.pdf')
        expect(parsed.data.replyToExternalId).toBe('WAM_CUST_INBOUND_123')
      }
    })

    it('should validate SendWaReactionJobPayload schema', () => {
      const validReaction: SendWaReactionJobPayload = {
        channelId,
        recipientNumber,
        targetExternalMessageId: 'WAM_TARGET_123',
        emoji: '👍',
      }

      const parsed = SendWaReactionJobPayloadSchema.safeParse(validReaction)
      expect(parsed.success).toBe(true)
    })

    it('should validate WaMessageStatusEvent schema', () => {
      const validStatus: WaMessageStatusEvent = {
        externalMessageId: 'WAM_SENT_OUT_001',
        status: 'sent',
        timestamp: new Date().toISOString(),
      }

      const parsed = WaMessageStatusEventSchema.safeParse(validStatus)
      expect(parsed.success).toBe(true)
    })
  })

  describe('Outbound Message Dispatcher (OutboundMessageDispatcher)', () => {
    let mockSocket: {
      sendMessage: (
        jid: string,
        content: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>
    }
    let sentMessages: { jid: string; content: Record<string, unknown> }[] = []
    let connectionManager: BaileysConnectionManager
    let publishedStatusEvents: { channel: string; data: WaMessageStatusEvent }[] = []
    let mockPublisher: RedisEventPublisher

    beforeEach(() => {
      sentMessages = []
      publishedStatusEvents = []

      mockSocket = {
        sendMessage: async (jid, content) => {
          sentMessages.push({ jid, content })
          return { key: { id: `WAM_OUT_${Date.now()}` } }
        },
      }

      const mockRedisClient: RedisPublisherClient = {
        publish: async (channel, message) => {
          publishedStatusEvents.push({ channel, data: JSON.parse(message) })
          return 1
        },
      }
      mockPublisher = new RedisEventPublisher({ redisClient: mockRedisClient })

      connectionManager = new BaileysConnectionManager()
    })

    it('should dispatch text message through active Baileys socket', async () => {
      const session = await connectionManager.createSession({
        sessionId: 'session_outbound_1',
        channelId,
        inboxId,
      })
      session.socket = mockSocket
      session.status = 'connected'

      const dispatcher = new OutboundMessageDispatcher({
        connectionManager,
        redisPublisher: mockPublisher,
      })

      const payload: SendWaMessageJobPayload = {
        jobId: '88888888-8888-4888-a888-888888888888',
        messageId,
        channelId,
        recipientNumber,
        messageType: 'text',
        text: 'Halo dari agent Xatxoot!',
      }

      const result = await dispatcher.sendMessage(payload)
      expect(result.success).toBe(true)
      expect(result.externalMessageId).toStartWith('WAM_OUT_')

      // Verifikasi socket dipanggil
      expect(sentMessages.length).toBe(1)
      expect(sentMessages[0].jid).toBe('6281234567890@s.whatsapp.net')
      expect(sentMessages[0].content.text).toBe('Halo dari agent Xatxoot!')

      // Verifikasi status 'sent' dipublish ke Redis
      expect(publishedStatusEvents.length).toBe(1)
      expect(publishedStatusEvents[0].channel).toBe('wa:message:status')
      expect(publishedStatusEvents[0].data.externalMessageId).toBe(result.externalMessageId)
      expect(publishedStatusEvents[0].data.status).toBe('sent')
    })

    it('should dispatch media message (image/document) with URL', async () => {
      const session = await connectionManager.createSession({
        sessionId: 'session_outbound_2',
        channelId,
        inboxId,
      })
      session.socket = mockSocket
      session.status = 'connected'

      const dispatcher = new OutboundMessageDispatcher({
        connectionManager,
        redisPublisher: mockPublisher,
      })

      const payload: SendWaMessageJobPayload = {
        jobId: '88888888-8888-4888-a888-888888888888',
        messageId,
        channelId,
        recipientNumber,
        messageType: 'image',
        text: 'Foto profil produk',
        mediaUrl: 'https://example.com/product.jpg',
      }

      const result = await dispatcher.sendMessage(payload)
      expect(result.success).toBe(true)
      expect(sentMessages.length).toBe(1)
      expect(sentMessages[0].content.image).toEqual({ url: 'https://example.com/product.jpg' })
      expect(sentMessages[0].content.caption).toBe('Foto profil produk')
    })

    it('should dispatch reaction emoji message', async () => {
      const session = await connectionManager.createSession({
        sessionId: 'session_outbound_3',
        channelId,
        inboxId,
      })
      session.socket = mockSocket
      session.status = 'connected'

      const dispatcher = new OutboundMessageDispatcher({
        connectionManager,
        redisPublisher: mockPublisher,
      })

      const payload: SendWaReactionJobPayload = {
        channelId,
        recipientNumber,
        targetExternalMessageId: 'WAM_TARGET_123',
        emoji: '❤️',
      }

      const result = await dispatcher.sendReaction(payload)
      expect(result.success).toBe(true)
      expect(sentMessages.length).toBe(1)
      expect(sentMessages[0].content.react).toBeDefined()
    })

    it('should throw error when session is not found or not connected', async () => {
      const dispatcher = new OutboundMessageDispatcher({
        connectionManager,
        redisPublisher: mockPublisher,
      })

      const payload: SendWaMessageJobPayload = {
        jobId: '88888888-8888-4888-a888-888888888888',
        messageId,
        channelId,
        recipientNumber,
        messageType: 'text',
        text: 'Pesan ke session offline',
      }

      expect(dispatcher.sendMessage(payload)).rejects.toThrow('No connected Baileys session')
    })
  })

  describe('BullMQ Outbound Job Processor (processOutboundJob)', () => {
    let mockDispatcher: {
      sendMessage: (
        payload: SendWaMessageJobPayload,
      ) => Promise<{ success: boolean; externalMessageId: string }>
      sendReaction: (
        payload: SendWaReactionJobPayload,
      ) => Promise<{ success: boolean; externalMessageId: string }>
    }

    beforeEach(() => {
      mockDispatcher = {
        sendMessage: async (p) => ({ success: true, externalMessageId: `OUT_${p.messageId}` }),
        sendReaction: async () => ({ success: true, externalMessageId: 'REACT_001' }),
      }
    })

    it('should process send-message job successfully', async () => {
      const job = {
        name: JOB_NAME_SEND_MESSAGE,
        data: {
          jobId: '88888888-8888-4888-a888-888888888888',
          messageId,
          channelId,
          recipientNumber,
          messageType: 'text',
          text: 'Pesan dari antrean BullMQ',
        },
      }

      const result = await processOutboundJob(
        job,
        mockDispatcher as unknown as OutboundMessageDispatcher,
      )
      expect(result.success).toBe(true)
      expect(result.externalMessageId).toBe(`OUT_${messageId}`)
    })

    it('should process send-reaction job successfully', async () => {
      const job = {
        name: JOB_NAME_SEND_REACTION,
        data: {
          channelId,
          recipientNumber,
          targetExternalMessageId: 'WAM_ORIGINAL_MSG',
          emoji: '👍',
        },
      }

      const result = await processOutboundJob(
        job,
        mockDispatcher as unknown as OutboundMessageDispatcher,
      )
      expect(result.success).toBe(true)
      expect(result.externalMessageId).toBe('REACT_001')
    })

    it('should throw error for unknown job name', async () => {
      const job = {
        name: 'unknown-job-type',
        data: {},
      }

      expect(
        processOutboundJob(job, mockDispatcher as unknown as OutboundMessageDispatcher),
      ).rejects.toThrow('Unknown job name')
    })
  })
})
