import { DisconnectReason } from '@whiskeysockets/baileys'
import type { ConnectionEventHandlers, GatewayConnectionStatus } from '../types/connection'
import { mapDisconnectReasonToStatus } from './disconnect-handler'

export interface SessionInitParams {
  sessionId: string
  handlers?: ConnectionEventHandlers
}

export class BaileysSession {
  readonly sessionId: string
  status: GatewayConnectionStatus = 'connecting'
  shouldReconnect = true
  handlers?: ConnectionEventHandlers
  socket?: unknown

  constructor(params: SessionInitParams) {
    this.sessionId = params.sessionId
    this.handlers = params.handlers
  }

  emitQr(qr: string): void {
    this.status = 'pairing'
    this.handlers?.onQrCode?.(qr)
    this.handlers?.onStatusChange?.(this.status, { qr })
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
