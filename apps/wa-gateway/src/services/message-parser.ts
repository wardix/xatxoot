import type { WaInboundMessageEvent, WaInboundMessageType } from '../types/events'

export interface WAMessageKey {
  remoteJid?: string | null
  fromMe?: boolean | null
  id?: string | null
}

export interface WAMessageContent {
  conversation?: string | null
  extendedTextMessage?: {
    text?: string | null
    contextInfo?: {
      stanzaId?: string | null
    } | null
  } | null
  imageMessage?: {
    caption?: string | null
    mimetype?: string | null
    fileLength?: number | null
  } | null
  videoMessage?: {
    caption?: string | null
    mimetype?: string | null
    fileLength?: number | null
  } | null
  audioMessage?: {
    mimetype?: string | null
    fileLength?: number | null
  } | null
  documentMessage?: {
    caption?: string | null
    fileName?: string | null
    mimetype?: string | null
    fileLength?: number | null
  } | null
  locationMessage?: {
    degreesLatitude?: number | null
    degreesLongitude?: number | null
  } | null
  stickerMessage?: {
    mimetype?: string | null
  } | null
}

export interface MinimalWAMessage {
  key?: WAMessageKey | null
  pushName?: string | null
  message?: WAMessageContent | null
  messageTimestamp?: number | null
}

export function extractInboundMessage(
  wam: unknown,
  context: { channelId: string; inboxId: string },
): WaInboundMessageEvent | null {
  if (!wam || typeof wam !== 'object') {
    return null
  }

  const msg = wam as MinimalWAMessage
  const key = msg.key
  if (!key || !key.remoteJid || !key.id) {
    return null
  }

  // Ignore outgoing messages sent by the device
  if (key.fromMe) {
    return null
  }

  const remoteJid = key.remoteJid

  // Ignore group messages (@g.us) per FR-WU-12
  if (remoteJid.endsWith('@g.us')) {
    return null
  }

  // Ignore status broadcasts
  if (remoteJid === 'status@broadcast' || remoteJid.includes('@broadcast')) {
    return null
  }

  const senderNumber = remoteJid.replace(/@.*$/, '')
  const contentObj = msg.message
  if (!contentObj) {
    return null
  }

  let messageType: WaInboundMessageType = 'text'
  let content: string | undefined
  let replyToExternalId: string | undefined
  let media: WaInboundMessageEvent['media'] | undefined

  if (typeof contentObj.conversation === 'string') {
    messageType = 'text'
    content = contentObj.conversation
  } else if (contentObj.extendedTextMessage) {
    messageType = 'text'
    content = contentObj.extendedTextMessage.text || undefined
    replyToExternalId = contentObj.extendedTextMessage.contextInfo?.stanzaId || undefined
  } else if (contentObj.imageMessage) {
    messageType = 'image'
    content = contentObj.imageMessage.caption || undefined
    media = {
      mimeType: contentObj.imageMessage.mimetype || 'image/jpeg',
      fileSize: contentObj.imageMessage.fileLength
        ? Number(contentObj.imageMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.videoMessage) {
    messageType = 'video'
    content = contentObj.videoMessage.caption || undefined
    media = {
      mimeType: contentObj.videoMessage.mimetype || 'video/mp4',
      fileSize: contentObj.videoMessage.fileLength
        ? Number(contentObj.videoMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.audioMessage) {
    messageType = 'audio'
    media = {
      mimeType: contentObj.audioMessage.mimetype || 'audio/ogg',
      fileSize: contentObj.audioMessage.fileLength
        ? Number(contentObj.audioMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.documentMessage) {
    messageType = 'document'
    content = contentObj.documentMessage.caption || undefined
    media = {
      mimeType: contentObj.documentMessage.mimetype || 'application/octet-stream',
      fileName: contentObj.documentMessage.fileName || undefined,
      fileSize: contentObj.documentMessage.fileLength
        ? Number(contentObj.documentMessage.fileLength)
        : undefined,
    }
  } else if (contentObj.locationMessage) {
    messageType = 'location'
    const lat = contentObj.locationMessage.degreesLatitude ?? 0
    const lng = contentObj.locationMessage.degreesLongitude ?? 0
    content = `${lat},${lng}`
  } else if (contentObj.stickerMessage) {
    messageType = 'sticker'
    media = {
      mimeType: contentObj.stickerMessage.mimetype || 'image/webp',
    }
  } else {
    return null
  }

  const timestamp = msg.messageTimestamp
    ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
    : new Date().toISOString()

  return {
    channelId: context.channelId,
    inboxId: context.inboxId,
    senderNumber,
    senderName: msg.pushName || undefined,
    externalMessageId: key.id,
    messageType,
    content,
    media,
    replyToExternalId,
    timestamp,
  }
}
