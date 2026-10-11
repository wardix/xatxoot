import { createHmac, timingSafeEqual } from 'node:crypto'
import { sql } from '../../db'

export const DEFAULT_META_APP_SECRET =
  process.env.META_APP_SECRET || 'meta_test_app_secret_1234567890'
export const DEFAULT_META_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || 'meta_verify_token_super_secret_123'

// Idempotency cache for processed WhatsApp message IDs (wamid)
const processedMessageIds = new Set<string>()

export function resetWebhookCache(): void {
  processedMessageIds.clear()
}

export function verifyMetaWebhookSignature(
  payloadRaw: string,
  signatureHeader?: string | null,
  appSecret?: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const secret = appSecret || DEFAULT_META_APP_SECRET
  const expectedHash = createHmac('sha256', secret).update(payloadRaw).digest('hex')
  const expectedSignature = `sha256=${expectedHash}`

  try {
    const receivedBuffer = Buffer.from(signatureHeader)
    const expectedBuffer = Buffer.from(expectedSignature)
    if (receivedBuffer.length !== expectedBuffer.length) {
      return false
    }
    return timingSafeEqual(receivedBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export function verifyWebhookChallenge(
  queryParams: Record<string, string | undefined>,
  expectedToken?: string,
): string | null {
  const mode = queryParams['hub.mode']
  const token = queryParams['hub.verify_token']
  const challenge = queryParams['hub.challenge']

  if (mode !== 'subscribe') {
    return null
  }

  const verifyToken = expectedToken || DEFAULT_META_VERIFY_TOKEN
  if (token !== verifyToken) {
    return null
  }

  return challenge || null
}

export interface ParsedMetaMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: { id: string; mime_type: string; sha256?: string; caption?: string }
  document?: { id: string; filename?: string; mime_type: string; sha256?: string }
  audio?: { id: string; mime_type: string; voice?: boolean }
  video?: { id: string; mime_type: string; caption?: string }
  interactive?: { type: string; button_reply?: { id: string; title: string } }
  reaction?: { message_id: string; emoji: string }
}

export function parseMetaInboundMessage(messageObj: Record<string, unknown>): ParsedMetaMessage {
  const msg = messageObj as unknown as ParsedMetaMessage
  return {
    from: msg.from,
    id: msg.id,
    timestamp: msg.timestamp,
    type: msg.type,
    text: msg.text,
    image: msg.image,
    document: msg.document,
    audio: msg.audio,
    video: msg.video,
    interactive: msg.interactive,
    reaction: msg.reaction,
  }
}

export interface ProcessWebhookResult {
  success: boolean
  processedCount: number
  isDuplicate?: boolean
  statusUpdated?: boolean
  messages?: ParsedMetaMessage[]
}

export async function processMetaWebhookPayload(
  payload: Record<string, unknown>,
): Promise<ProcessWebhookResult> {
  const entries = (payload.entry as Array<Record<string, unknown>>) || []
  let processedCount = 0
  let isDuplicate = false
  let statusUpdated = false
  const extractedMessages: ParsedMetaMessage[] = []

  for (const entry of entries) {
    const changes = (entry.changes as Array<Record<string, unknown>>) || []
    for (const change of changes) {
      const val = (change.value as Record<string, unknown>) || {}

      // 1. Process Inbound Messages
      const messages = (val.messages as Array<Record<string, unknown>>) || []
      for (const msg of messages) {
        const msgId = msg.id as string
        if (msgId) {
          if (processedMessageIds.has(msgId)) {
            isDuplicate = true
            continue
          }
          processedMessageIds.add(msgId)
        }

        const parsed = parseMetaInboundMessage(msg)
        extractedMessages.push(parsed)
        processedCount++
      }

      // 2. Process Delivery Receipts / Statuses
      const statuses = (val.statuses as Array<Record<string, unknown>>) || []
      if (statuses.length > 0) {
        statusUpdated = true
      }
    }
  }

  return {
    success: true,
    processedCount,
    isDuplicate: isDuplicate && processedCount === 0,
    statusUpdated,
    messages: extractedMessages,
  }
}

export async function getVerifyTokenForPhoneNumberId(phoneNumberId?: string): Promise<string> {
  if (!phoneNumberId) {
    return DEFAULT_META_VERIFY_TOKEN
  }

  try {
    const rows = await sql`
      SELECT webhook_verify_token as "webhookVerifyToken"
      FROM channels_whatsapp_cloud
      WHERE phone_number_id = ${phoneNumberId}
      LIMIT 1
    `
    if (rows.length > 0 && rows[0].webhookVerifyToken) {
      return rows[0].webhookVerifyToken
    }
  } catch {
    // DB offline, return default
  }

  return DEFAULT_META_VERIFY_TOKEN
}
