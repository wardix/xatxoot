import { describe, expect, it } from 'bun:test'
import {
  AttachmentInputSchema,
  AttachmentSchema,
  CreateMessageInputSchema,
  CreateTicketInputSchema,
  MessageContentTypeSchema,
  MessageSchema,
  MessageSenderTypeSchema,
  MessageStatusSchema,
  MessageTypeSchema,
  TicketPrioritySchema,
  TicketSchema,
  TicketStatusSchema,
  UpdateTicketInternalNoteInputSchema,
  UpdateTicketStatusInputSchema,
  isValidTicketTransition,
} from '../packages/shared/src/index'

describe('Message Payload & Ticket Lifecycle Zod Validation Schemas (Task 1.7)', () => {
  describe('Ticket Lifecycle & Transitions', () => {
    it('should validate allowed ticket statuses and priorities', () => {
      expect(TicketStatusSchema.safeParse('open').success).toBe(true)
      expect(TicketStatusSchema.safeParse('pending').success).toBe(true)
      expect(TicketStatusSchema.safeParse('snoozed').success).toBe(true)
      expect(TicketStatusSchema.safeParse('resolved').success).toBe(true)
      expect(TicketStatusSchema.safeParse('closed').success).toBe(false)

      expect(TicketPrioritySchema.safeParse('low').success).toBe(true)
      expect(TicketPrioritySchema.safeParse('medium').success).toBe(true)
      expect(TicketPrioritySchema.safeParse('high').success).toBe(true)
      expect(TicketPrioritySchema.safeParse('urgent').success).toBe(true)
      expect(TicketPrioritySchema.safeParse('critical').success).toBe(false)
    })

    it('should validate valid ticket status transitions', () => {
      expect(isValidTicketTransition('open', 'pending')).toBe(true)
      expect(isValidTicketTransition('pending', 'open')).toBe(true)
      expect(isValidTicketTransition('open', 'snoozed')).toBe(true)
      expect(isValidTicketTransition('snoozed', 'open')).toBe(true)
      expect(isValidTicketTransition('open', 'resolved')).toBe(true)
      expect(isValidTicketTransition('pending', 'resolved')).toBe(true)
      expect(isValidTicketTransition('snoozed', 'resolved')).toBe(true)
      expect(isValidTicketTransition('resolved', 'open')).toBe(true)
      expect(isValidTicketTransition('open', 'open')).toBe(false)
    })

    it('should validate CreateTicketInputSchema with defaults', () => {
      const input = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
      }

      const result = CreateTicketInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('open')
        expect(result.data.priority).toBe('medium')
        expect(result.data.customAttributes).toEqual({})
      }
    })

    it('should validate UpdateTicketStatusInputSchema', () => {
      const valid = {
        status: 'snoozed',
        snoozedUntil: new Date(Date.now() + 86400000).toISOString(),
      }

      const result = UpdateTicketStatusInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should validate UpdateTicketInternalNoteInputSchema (1:1 Sticky Note)', () => {
      const valid = {
        internalNote: 'Pelanggan meminta refund invoice #INV-990.',
      }

      const result = UpdateTicketInternalNoteInputSchema.safeParse(valid)
      expect(result.success).toBe(true)
    })

    it('should validate complete Ticket entity record', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        displayId: 101,
        conversationId: '223e4567-e89b-12d3-a456-426614174000',
        assigneeId: null,
        teamId: null,
        status: 'open',
        priority: 'medium',
        snoozedUntil: null,
        waitingSince: null,
        deadlineAt: null,
        firstReplyCreatedAt: null,
        openedAt: new Date().toISOString(),
        resolvedAt: null,
        internalNote: 'Case note tersemat',
        internalNoteUpdatedBy: null,
        internalNoteUpdatedAt: null,
        customAttributes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = TicketSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('Message Payload & Communication Types', () => {
    it('should validate message enums: sender_type, message_type, content_type, status', () => {
      expect(MessageSenderTypeSchema.safeParse('user').success).toBe(true)
      expect(MessageSenderTypeSchema.safeParse('contact').success).toBe(true)
      expect(MessageSenderTypeSchema.safeParse('bot').success).toBe(true)
      expect(MessageSenderTypeSchema.safeParse('system').success).toBe(true)
      expect(MessageSenderTypeSchema.safeParse('admin').success).toBe(false)

      expect(MessageTypeSchema.safeParse('incoming').success).toBe(true)
      expect(MessageTypeSchema.safeParse('outgoing').success).toBe(true)
      expect(MessageTypeSchema.safeParse('activity').success).toBe(true)
      expect(MessageTypeSchema.safeParse('template').success).toBe(true)
      expect(MessageTypeSchema.safeParse('broadcast').success).toBe(false)

      expect(MessageContentTypeSchema.safeParse('text').success).toBe(true)
      expect(MessageContentTypeSchema.safeParse('image').success).toBe(true)
      expect(MessageContentTypeSchema.safeParse('video').success).toBe(true)
      expect(MessageContentTypeSchema.safeParse('audio').success).toBe(true)
      expect(MessageContentTypeSchema.safeParse('file').success).toBe(true)

      expect(MessageStatusSchema.safeParse('sent').success).toBe(true)
      expect(MessageStatusSchema.safeParse('delivered').success).toBe(true)
      expect(MessageStatusSchema.safeParse('read').success).toBe(true)
      expect(MessageStatusSchema.safeParse('failed').success).toBe(true)
    })

    it('should validate CreateMessageInputSchema with attachments', () => {
      const input = {
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        senderType: 'user',
        content: 'Halo, ada yang bisa kami bantu?',
        attachments: [
          {
            fileType: 'image/png',
            fileUrl: 'https://storage.xatxoot.com/receipt.png',
            fileSize: 1048576,
            fileName: 'receipt.png',
          },
        ],
      }

      const result = CreateMessageInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.senderType).toBe('user')
        expect(result.data.messageType).toBe('incoming')
        expect(result.data.contentType).toBe('text')
        expect(result.data.status).toBe('sent')
        expect(result.data.attachments).toHaveLength(1)
      }
    })

    it('should reject CreateMessageInputSchema with invalid conversationId', () => {
      const invalid = {
        conversationId: 'not-a-uuid',
        senderType: 'contact',
        content: 'Halo',
      }

      const result = CreateMessageInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate complete Message and Attachment entities', () => {
      const attachment = {
        id: '223e4567-e89b-12d3-a456-426614174000',
        messageId: '123e4567-e89b-12d3-a456-426614174000',
        fileType: 'application/pdf',
        fileUrl: 'https://storage.xatxoot.com/doc.pdf',
        thumbUrl: null,
        fileSize: 2048,
        fileName: 'doc.pdf',
        metadata: {},
        createdAt: new Date().toISOString(),
      }

      expect(AttachmentSchema.safeParse(attachment).success).toBe(true)

      const message = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        conversationId: '323e4567-e89b-12d3-a456-426614174000',
        ticketId: '423e4567-e89b-12d3-a456-426614174000',
        senderType: 'contact',
        senderId: null,
        messageType: 'incoming',
        content: 'Saya butuh bantuan.',
        contentType: 'text',
        status: 'delivered',
        externalSourceId: 'wamid.HBgLMjYw...',
        contentAttributes: {},
        attachments: [attachment],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(MessageSchema.safeParse(message).success).toBe(true)
    })
  })
})
