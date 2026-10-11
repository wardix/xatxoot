import { DisconnectReason } from '@whiskeysockets/baileys'
import type { GatewayConnectionStatus } from '../types/connection'

export function mapDisconnectReasonToStatus(statusCode?: number): GatewayConnectionStatus {
  if (statusCode === DisconnectReason.loggedOut) {
    return 'logged_out'
  }
  return 'disconnected'
}
