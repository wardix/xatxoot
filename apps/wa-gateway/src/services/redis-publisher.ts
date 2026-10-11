import Redis from 'ioredis'
import {
  REDIS_CHANNEL_WA_INBOUND_MESSAGE,
  REDIS_CHANNEL_WA_SESSION_QR,
  type WaInboundMessageEvent,
  WaInboundMessageEventSchema,
  type WaSessionQrEvent,
  WaSessionQrEventSchema,
} from '../types/events'

export interface RedisPublisherClient {
  publish: (channel: string, message: string) => Promise<number>
}

export interface RedisPublisherOptions {
  redisClient?: RedisPublisherClient
  redisUrl?: string
}

export class RedisEventPublisher {
  private client: RedisPublisherClient

  constructor(options: RedisPublisherOptions = {}) {
    if (options.redisClient) {
      this.client = options.redisClient
    } else {
      this.client = new Redis(options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379')
    }
  }

  async publishSessionQr(event: WaSessionQrEvent): Promise<number> {
    const validated = WaSessionQrEventSchema.parse(event)
    return this.client.publish(REDIS_CHANNEL_WA_SESSION_QR, JSON.stringify(validated))
  }

  async publishInboundMessage(event: WaInboundMessageEvent): Promise<number> {
    const validated = WaInboundMessageEventSchema.parse(event)
    return this.client.publish(REDIS_CHANNEL_WA_INBOUND_MESSAGE, JSON.stringify(validated))
  }
}
