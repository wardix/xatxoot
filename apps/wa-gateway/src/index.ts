export { DisconnectReason } from '@whiskeysockets/baileys'
export {
  BaileysConnectionManager,
  baileysConnectionManager,
  type CreateSessionParams,
} from './services/baileys-connection-manager'
export { BaileysSession, type SessionInitParams } from './services/baileys-session'
export { mapDisconnectReasonToStatus } from './services/disconnect-handler'
export { createSocketConfig, DEFAULT_BROWSER } from './services/socket-config'
export type {
  ConnectionEventHandlers,
  GatewayConnectionStatus,
  SocketConfigOptions,
} from './types/connection'
