import { z } from 'zod'

export const REDIS_CHANNEL_WA_SESSION_QR = 'wa:session:qr'
export const REDIS_CHANNEL_WA_INBOUND_MESSAGE = 'wa:inbound:message'

export const WaSessionQrEventSchema = z.object({
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  inboxId: z.string().uuid('Inbox ID harus berupa UUID valid'),
  qrCode: z.string().min(1, 'QR code tidak boleh kosong'),
  expiresInSeconds: z.number().int().positive().default(60),
  timestamp: z.string().min(1, 'Timestamp wajib diisi'),
})

export type WaSessionQrEvent = z.infer<typeof WaSessionQrEventSchema>

export const WaInboundMessageTypeSchema = z.enum([
  'text',
  'image',
  'video',
  'audio',
  'document',
  'location',
  'sticker',
])
export type WaInboundMessageType = z.infer<typeof WaInboundMessageTypeSchema>

export const WaInboundMessageEventSchema = z.object({
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  inboxId: z.string().uuid('Inbox ID harus berupa UUID valid'),
  senderNumber: z.string().min(1, 'Sender number wajib diisi'),
  senderName: z.string().optional(),
  externalMessageId: z.string().min(1, 'External message ID wajib diisi'),
  messageType: WaInboundMessageTypeSchema,
  content: z.string().optional(),
  media: z
    .object({
      mimeType: z.string(),
      fileName: z.string().optional(),
      fileSize: z.number().optional(),
      bufferBase64: z.string().optional(),
    })
    .optional(),
  replyToExternalId: z.string().optional(),
  timestamp: z.string().min(1, 'Timestamp wajib diisi'),
  isEcho: z.boolean().optional(),
  isEdit: z.boolean().optional(),
  targetExternalId: z.string().optional(),
  newContent: z.string().optional(),
  editedAt: z.string().optional(),
})

export type WaInboundMessageEvent = z.infer<typeof WaInboundMessageEventSchema>

export const REDIS_CHANNEL_WA_MESSAGE_STATUS = 'wa:message:status'

export const WaMessageStatusEventSchema = z.object({
  externalMessageId: z.string().min(1, 'External message ID wajib diisi'),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  failureReason: z.string().optional(),
  timestamp: z.string().min(1, 'Timestamp wajib diisi'),
})

export type WaMessageStatusEvent = z.infer<typeof WaMessageStatusEventSchema>
