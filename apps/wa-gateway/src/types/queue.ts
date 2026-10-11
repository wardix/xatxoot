import { z } from 'zod'

export const BULLMQ_QUEUE_WA_OUTBOUND = 'wa-outbound'
export const JOB_NAME_SEND_MESSAGE = 'send-message'
export const JOB_NAME_SEND_REACTION = 'send-reaction'

export const SendWaMessageJobPayloadSchema = z.object({
  jobId: z.string().uuid('Job ID harus berupa UUID valid'),
  messageId: z.string().uuid('Message ID harus berupa UUID valid'),
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  recipientNumber: z.string().min(1, 'Recipient number wajib diisi'),
  messageType: z.enum(['text', 'image', 'video', 'audio', 'document']),
  text: z.string().optional(),
  mediaUrl: z.string().url('Media URL harus berupa URL valid').optional(),
  fileName: z.string().optional(),
  replyToExternalId: z.string().optional(),
})

export type SendWaMessageJobPayload = z.infer<typeof SendWaMessageJobPayloadSchema>

export const SendWaReactionJobPayloadSchema = z.object({
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  recipientNumber: z.string().min(1, 'Recipient number wajib diisi'),
  targetExternalMessageId: z.string().min(1, 'Target external message ID wajib diisi'),
  emoji: z.string(),
})

export type SendWaReactionJobPayload = z.infer<typeof SendWaReactionJobPayloadSchema>
