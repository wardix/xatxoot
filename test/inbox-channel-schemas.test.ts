import { describe, expect, it } from 'bun:test'
import {
  ChannelTypeSchema,
  CreateApiChannelInputSchema,
  CreateInboxInputSchema,
  CreateWebWidgetChannelInputSchema,
  CreateWhatsAppCloudChannelInputSchema,
  CreateWhatsAppUnofficialChannelInputSchema,
  InboxMemberSchema,
  InboxSchema,
  SenderNameTypeSchema,
  UpdateInboxInputSchema,
  WebWidgetChannelSchema,
  WhatsAppCloudChannelSchema,
  WhatsAppUnofficialChannelSchema,
} from '../packages/shared/src/index'

describe('Inbox & Channel Zod Validation Schemas (Task 1.5)', () => {
  describe('ChannelTypeSchema & SenderNameTypeSchema', () => {
    it('should validate allowed channel types', () => {
      expect(ChannelTypeSchema.safeParse('whatsapp_cloud').success).toBe(true)
      expect(ChannelTypeSchema.safeParse('whatsapp_unofficial').success).toBe(true)
      expect(ChannelTypeSchema.safeParse('web_widget').success).toBe(true)
      expect(ChannelTypeSchema.safeParse('api').success).toBe(true)
      expect(ChannelTypeSchema.safeParse('invalid_channel').success).toBe(false)
    })

    it('should validate sender name types', () => {
      expect(SenderNameTypeSchema.safeParse('friendly').success).toBe(true)
      expect(SenderNameTypeSchema.safeParse('professional').success).toBe(true)
      expect(SenderNameTypeSchema.safeParse('custom').success).toBe(false)
    })
  })

  describe('WhatsApp Cloud Channel Schemas', () => {
    it('should validate valid WhatsApp Cloud channel creation input', () => {
      const valid = {
        phoneNumber: '+628123456789',
        phoneNumberId: '100234567890123',
        wabaId: '200345678901234',
        accessToken: 'EAABwz...',
        webhookVerifyToken: 'super_secure_verify_token_123',
      }

      const result = CreateWhatsAppCloudChannelInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should reject WhatsApp Cloud input with missing required fields', () => {
      const invalid = {
        phoneNumber: '+628123456789',
        phoneNumberId: '',
        wabaId: '200345678901234',
      }

      const result = CreateWhatsAppCloudChannelInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate complete WhatsApp Cloud channel entity', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        phoneNumber: '+628123456789',
        phoneNumberId: '100234567890123',
        wabaId: '200345678901234',
        accessToken: 'token_val',
        webhookVerifyToken: 'verify_token',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = WhatsAppCloudChannelSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('WhatsApp Unofficial Channel Schemas', () => {
    it('should validate valid WhatsApp Unofficial channel creation input', () => {
      const valid = {
        sessionId: 'session_default_baileys_01',
        phoneNumber: '+628987654321',
        connectionStatus: 'disconnected',
      }

      const result = CreateWhatsAppUnofficialChannelInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.connectionStatus).toBe('disconnected')
      }
    })

    it('should validate full WhatsApp Unofficial entity', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        sessionId: 'session_01',
        phoneNumber: '+628987654321',
        connectionStatus: 'connected',
        qrCode: 'data:image/png;base64,...',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = WhatsAppUnofficialChannelSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('Web Widget Channel Schemas', () => {
    it('should validate valid Web Widget input and apply sensible defaults', () => {
      const input = {
        websiteUrl: 'https://example.com',
        allowedDomains: ['example.com', 'app.example.com'],
      }

      const result = CreateWebWidgetChannelInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.widgetColor).toBe('#10b981')
        expect(result.data.replyTime).toBe('in_a_few_minutes')
        expect(result.data.preChatFormEnabled).toBe(false)
      }
    })

    it('should validate full Web Widget entity', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        websiteToken: 'token_web_123',
        websiteUrl: 'https://example.com',
        allowedDomains: ['example.com'],
        widgetColor: '#059669',
        replyTime: 'in_a_few_hours',
        preChatFormEnabled: true,
        hmacSecret: 'secret_key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = WebWidgetChannelSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('API Channel Schemas', () => {
    it('should validate valid API channel input', () => {
      const input = {
        name: 'CRM Webhook Channel',
        webhookUrl: 'https://crm.example.com/webhooks/incoming',
      }

      const result = CreateApiChannelInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })
  })

  describe('Inbox Schemas', () => {
    it('should validate valid Inbox creation input and apply defaults', () => {
      const input = {
        name: 'WhatsApp Support ID',
        channelType: 'whatsapp_cloud',
        channelId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = CreateInboxInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('WhatsApp Support ID')
        expect(result.data.enableAutoAssign).toBe(true)
        expect(result.data.greetingEnabled).toBe(false)
        expect(result.data.senderNameType).toBe('friendly')
      }
    })

    it('should reject Inbox input with invalid channelId or missing name', () => {
      const invalid = {
        name: '',
        channelType: 'whatsapp_cloud',
        channelId: 'not-a-uuid',
      }

      const result = CreateInboxInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate partial update for Inbox', () => {
      const update = {
        name: 'Updated WhatsApp Support',
        greetingEnabled: true,
        greetingMessage: 'Halo! Selamat datang di Customer Service Xatxoot.',
      }

      const result = UpdateInboxInputSchema.safeParse(update)
      expect(result.success).toBe(true)
    })

    it('should validate complete Inbox entity record', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Support Utama',
        channelType: 'whatsapp_cloud',
        channelId: '223e4567-e89b-12d3-a456-426614174000',
        enableAutoAssign: true,
        greetingEnabled: false,
        greetingMessage: null,
        workingHoursEnabled: false,
        workingHours: {},
        outOfOfficeMessage: null,
        lockToSingleConv: false,
        senderNameType: 'friendly',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = InboxSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })

    it('should validate InboxMember mapping schema', () => {
      const member = {
        inboxId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '223e4567-e89b-12d3-a456-426614174000',
      }

      const result = InboxMemberSchema.safeParse(member)
      expect(result.success).toBe(true)
    })
  })
})
