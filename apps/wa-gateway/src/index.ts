export { DisconnectReason } from '@whiskeysockets/baileys'
export {
  BaileysConnectionManager,
  baileysConnectionManager,
  type CreateSessionParams,
} from './services/baileys-connection-manager'
export { BaileysSession, type SessionInitParams } from './services/baileys-session'
export { mapDisconnectReasonToStatus } from './services/disconnect-handler'
export {
  RedisEventPublisher,
  type RedisPublisherClient,
  type RedisPublisherOptions,
} from './services/redis-publisher'
export { createSocketConfig, DEFAULT_BROWSER } from './services/socket-config'
export type {
  ConnectionEventHandlers,
  GatewayConnectionStatus,
  SocketConfigOptions,
} from './types/connection'
export { extractInboundMessage } from './services/message-parser'
export {
  REDIS_CHANNEL_WA_INBOUND_MESSAGE,
  REDIS_CHANNEL_WA_SESSION_QR,
  type WaInboundMessageEvent,
  WaInboundMessageEventSchema,
  type WaInboundMessageType,
  WaInboundMessageTypeSchema,
  type WaSessionQrEvent,
  WaSessionQrEventSchema,
} from './types/events'
