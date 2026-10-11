import { z } from 'zod'

export const REDIS_CHANNEL_WA_SESSION_QR = 'wa:session:qr'

export const WaSessionQrEventSchema = z.object({
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  inboxId: z.string().uuid('Inbox ID harus berupa UUID valid'),
  qrCode: z.string().min(1, 'QR code tidak boleh kosong'),
  expiresInSeconds: z.number().int().positive().default(60),
  timestamp: z.string().min(1, 'Timestamp wajib diisi'),
})

export type WaSessionQrEvent = z.infer<typeof WaSessionQrEventSchema>
