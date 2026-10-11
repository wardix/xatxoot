import type { ConnectionEventHandlers, SocketConfigOptions } from '../types/connection'
import { BaileysSession } from './baileys-session'
import type { RedisEventPublisher } from './redis-publisher'

export interface CreateSessionParams {
  sessionId: string
  channelId?: string
  inboxId?: string
  options?: Partial<SocketConfigOptions>
  handlers?: ConnectionEventHandlers
  redisPublisher?: RedisEventPublisher
}

export class BaileysConnectionManager {
  private sessions = new Map<string, BaileysSession>()

  async createSession(params: CreateSessionParams): Promise<BaileysSession> {
    const existing = this.sessions.get(params.sessionId)
    if (existing) {
      return existing
    }

    const session = new BaileysSession({
      sessionId: params.sessionId,
      channelId: params.channelId,
      inboxId: params.inboxId,
      handlers: params.handlers,
      redisPublisher: params.redisPublisher,
    })

    this.sessions.set(params.sessionId, session)
    return session
  }

  getSession(sessionId: string): BaileysSession | undefined {
    return this.sessions.get(sessionId)
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      await session.disconnect()
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      await session.disconnect()
      this.sessions.delete(sessionId)
    }
  }

  getAllSessions(): BaileysSession[] {
    return Array.from(this.sessions.values())
  }
}

export const baileysConnectionManager = new BaileysConnectionManager()
