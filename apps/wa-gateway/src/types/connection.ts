import type { AuthenticationState } from '@whiskeysockets/baileys'
import type { WhatsAppUnofficialConnectionStatus } from '@xatxoot/shared'

export type GatewayConnectionStatus = WhatsAppUnofficialConnectionStatus

export interface ConnectionEventHandlers {
  onStatusChange?: (status: GatewayConnectionStatus, details?: Record<string, unknown>) => void
  onQrCode?: (qr: string) => void
  onCredentialsUpdated?: (sessionId: string, authState: unknown) => void
  onMessageReceived?: (msg: unknown) => void
}

export interface SocketConfigOptions {
  sessionId: string
  authState: AuthenticationState
  printQRInTerminal?: boolean
  browser?: [string, string, string]
  syncFullHistory?: boolean
  loggerLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent'
}
