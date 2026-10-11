import { createHmac } from 'node:crypto'

export function generateMetaSignature(payloadJson: string, appSecret: string): string {
  const hmac = createHmac('sha256', appSecret)
  hmac.update(payloadJson)
  return `sha256=${hmac.digest('hex')}`
}

export interface InboundMessageOptions {
  customerPhone: string
  customerName?: string
  phoneNumberId?: string
  wabaId?: string
  displayPhoneNumber?: string
  messageId?: string
  timestamp?: number | string
  type?: 'text' | 'image' | 'document' | 'audio' | 'video' | 'interactive' | 'reaction'
  text?: string
  media?: {
    url?: string
    caption?: string
    mimeType?: string
    filename?: string
  }
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  reaction?: {
    message_id: string
    emoji: string
  }
}

export function buildInboundMessagePayload(
  options: InboundMessageOptions,
): Record<string, unknown> {
  const customerPhone = options.customerPhone
  const customerName = options.customerName || 'Customer'
  const phoneNumberId = options.phoneNumberId || 'mock_phone_number_id'
  const wabaId = options.wabaId || 'mock_waba_id'
  const displayPhoneNumber = options.displayPhoneNumber || '15550001234'
  const randomSuffix = Math.random().toString(36).substring(2, 9)
  const messageId = options.messageId || `wamid.mock_inbound_${Date.now()}_${randomSuffix}`
  const timestamp = String(options.timestamp || Math.floor(Date.now() / 1000))
  const type = options.type || 'text'

  const messageObj: Record<string, unknown> = {
    from: customerPhone,
    id: messageId,
    timestamp,
    type,
  }

  if (type === 'text') {
    messageObj.text = {
      body: options.text || '',
    }
  } else if (['image', 'document', 'audio', 'video'].includes(type) && options.media) {
    const mediaPayload: Record<string, unknown> = {
      link: options.media.url || '',
      caption: options.media.caption,
      mime_type: options.media.mimeType,
      filename: options.media.filename,
    }
    messageObj[type] = mediaPayload
  } else if (type === 'interactive' && options.interactive) {
    messageObj.interactive = options.interactive
  } else if (type === 'reaction' && options.reaction) {
    messageObj.reaction = options.reaction
  }

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: displayPhoneNumber,
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  profile: {
                    name: customerName,
                  },
                  wa_id: customerPhone,
                },
              ],
              messages: [messageObj],
            },
          },
        ],
      },
    ],
  }
}

export interface StatusReceiptOptions {
  messageId: string
  recipientPhone: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  phoneNumberId?: string
  wabaId?: string
  displayPhoneNumber?: string
  timestamp?: number | string
  error?: {
    code: number
    title: string
  }
}

export function buildStatusReceiptPayload(options: StatusReceiptOptions): Record<string, unknown> {
  const phoneNumberId = options.phoneNumberId || 'mock_phone_number_id'
  const wabaId = options.wabaId || 'mock_waba_id'
  const displayPhoneNumber = options.displayPhoneNumber || '15550001234'
  const timestamp = String(options.timestamp || Math.floor(Date.now() / 1000))

  const statusObj: Record<string, unknown> = {
    id: options.messageId,
    status: options.status,
    timestamp,
    recipient_id: options.recipientPhone,
  }

  if (options.error) {
    statusObj.errors = [options.error]
  }

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: wabaId,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: displayPhoneNumber,
                phone_number_id: phoneNumberId,
              },
              statuses: [statusObj],
            },
          },
        ],
      },
    ],
  }
}
