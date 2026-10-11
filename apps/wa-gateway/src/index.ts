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
export {
  createOutboundWorker,
  type CreateWorkerOptions,
  type OutboundJob,
  processOutboundJob,
} from './services/bullmq-worker'
export { extractInboundMessage } from './services/message-parser'
export {
  type DispatchResult,
  type OutboundDispatcherOptions,
  OutboundMessageDispatcher,
} from './services/outbound-dispatcher'
export {
  REDIS_CHANNEL_WA_INBOUND_MESSAGE,
  REDIS_CHANNEL_WA_MESSAGE_STATUS,
  REDIS_CHANNEL_WA_SESSION_QR,
  type WaInboundMessageEvent,
  WaInboundMessageEventSchema,
  type WaInboundMessageType,
  WaInboundMessageTypeSchema,
  type WaMessageStatusEvent,
  WaMessageStatusEventSchema,
  type WaSessionQrEvent,
  WaSessionQrEventSchema,
} from './types/events'
export {
  BULLMQ_QUEUE_WA_OUTBOUND,
  JOB_NAME_SEND_MESSAGE,
  JOB_NAME_SEND_REACTION,
  type SendWaMessageJobPayload,
  SendWaMessageJobPayloadSchema,
  type SendWaReactionJobPayload,
  SendWaReactionJobPayloadSchema,
} from './types/queue'
