import type { ConnectionEventHandlers, SocketConfigOptions } from '../types/connection'
import { BaileysSession } from './baileys-session'

export interface CreateSessionParams {
  sessionId: string
  options?: Partial<SocketConfigOptions>
  handlers?: ConnectionEventHandlers
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
      handlers: params.handlers,
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
