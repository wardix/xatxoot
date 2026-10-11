import { DisconnectReason } from '@whiskeysockets/baileys'
import type { ConnectionEventHandlers, GatewayConnectionStatus } from '../types/connection'
import { mapDisconnectReasonToStatus } from './disconnect-handler'
import type { RedisEventPublisher } from './redis-publisher'

export interface SessionInitParams {
  sessionId: string
  channelId?: string
  inboxId?: string
  handlers?: ConnectionEventHandlers
  redisPublisher?: RedisEventPublisher
}

export class BaileysSession {
  readonly sessionId: string
  readonly channelId?: string
  readonly inboxId?: string
  status: GatewayConnectionStatus = 'connecting'
  shouldReconnect = true
  handlers?: ConnectionEventHandlers
  redisPublisher?: RedisEventPublisher
  socket?: unknown

  constructor(params: SessionInitParams) {
    this.sessionId = params.sessionId
    this.channelId = params.channelId
    this.inboxId = params.inboxId
    this.handlers = params.handlers
    this.redisPublisher = params.redisPublisher
  }

  async emitQr(qr: string): Promise<void> {
    this.status = 'pairing'
    this.handlers?.onQrCode?.(qr)
    this.handlers?.onStatusChange?.(this.status, { qr })

    if (this.redisPublisher && this.channelId && this.inboxId) {
      await this.redisPublisher.publishSessionQr({
        channelId: this.channelId,
        inboxId: this.inboxId,
        qrCode: qr,
        expiresInSeconds: 60,
        timestamp: new Date().toISOString(),
      })
    }
  }

  emitConnected(details?: Record<string, unknown>): void {
    this.status = 'connected'
    this.shouldReconnect = true
    this.handlers?.onStatusChange?.(this.status, details)
  }

  emitDisconnect(reason?: number): void {
    this.status = mapDisconnectReasonToStatus(reason)
    if (reason === DisconnectReason.loggedOut) {
      this.shouldReconnect = false
    }
    this.handlers?.onStatusChange?.(this.status, { reason })
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected'
    this.handlers?.onStatusChange?.(this.status)
  }
}
