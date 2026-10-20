import {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import type { ConnectionEventHandlers, GatewayConnectionStatus } from '../types/connection'
import type { WaInboundMessageEvent } from '../types/events'
import { mapDisconnectReasonToStatus } from './disconnect-handler'
import { extractInboundMessage } from './message-parser'
import { outboundTracker } from './outbound-tracker'
import { rawMessageDumper } from './raw-message-dumper'
import type { RedisEventPublisher } from './redis-publisher'
import { DEFAULT_BROWSER } from './socket-config'

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
  currentQr: string | null = null
  phoneNumber: string | null = null
  shouldReconnect = true
  handlers?: ConnectionEventHandlers
  redisPublisher?: RedisEventPublisher
  // biome-ignore lint/suspicious/noExplicitAny: Baileys socket instance
  socket?: any
  flushInterval?: ReturnType<typeof setInterval>

  constructor(params: SessionInitParams) {
    this.sessionId = params.sessionId
    this.channelId = params.channelId
    this.inboxId = params.inboxId
    this.handlers = params.handlers
    this.redisPublisher = params.redisPublisher
  }

  async emitQr(qr: string): Promise<void> {
    this.currentQr = qr
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

  async handleInboundMessage(wam: unknown, isEcho = false): Promise<WaInboundMessageEvent | null> {
    console.log(
      `[wa-gateway] [${this.sessionId}] [DEBUG] handleInboundMessage processing... (isEcho=${isEcho})`,
    )
    const channelId = this.channelId || '00000000-0000-4000-a000-000000000000'
    const inboxId = this.inboxId || 'default'

    // biome-ignore lint/suspicious/noExplicitAny: wam key
    const anyWam = wam as any
    const remoteJid = anyWam?.key?.remoteJid || ''
    if (remoteJid.endsWith('@lid') && !anyWam?.key?.remoteJidAlt) {
      try {
        const pn = await this.socket?.signalRepository?.lidMapping?.getPNForLID(remoteJid)
        if (pn) {
          anyWam.key.remoteJidAlt = pn
        }
      } catch {
        // Ignore LID mapping error
      }
    }

    const effectiveSenderJid = anyWam?.key?.remoteJidAlt || remoteJid
    const myCleanNumber = this.phoneNumber ? this.phoneNumber.replace(/[^0-9]/g, '') : null
    const remoteCleanNumber = effectiveSenderJid.split('@')[0].split(':')[0]
    const isSelfChat = Boolean(myCleanNumber && remoteCleanNumber === myCleanNumber)

    const event = extractInboundMessage(wam, {
      channelId,
      inboxId,
      allowSelfChat: isSelfChat,
      isEcho,
    })

    if (!event) {
      console.log(
        `[wa-gateway] [${this.sessionId}] [DEBUG] extractInboundMessage returned null. Message keys:`,
        // biome-ignore lint/suspicious/noExplicitAny: inspect keys
        Object.keys((wam as any)?.message || {}),
      )
      return null
    }

    console.log(
      `[wa-gateway] [${this.sessionId}] [DEBUG] Extracted ${isEcho ? 'echo outgoing' : 'inbound'} message from ${event.senderNumber} (${event.senderName || 'No Name'}): "${event.content}"`,
    )

    // 1. Forward directly to API inbound webhook
    const apiPort = Number(process.env.PORT_API || 8800)
    const apiHost = '127.0.0.1'
    const apiUrl = `http://${apiHost}:${apiPort}/api/v1/webhooks/whatsapp-unofficial/inbound`

    try {
      console.log(`[wa-gateway] [${this.sessionId}] [DEBUG] Forwarding to API webhook: ${apiUrl}`)
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          channelId: this.channelId,
          inboxId: this.inboxId,
          senderNumber: event.senderNumber,
          senderName: event.senderName,
          externalMessageId: event.externalMessageId,
          messageType: event.messageType,
          content: event.content,
          timestamp: event.timestamp,
          isEcho: Boolean(isEcho || event.isEcho),
          isEdit: event.isEdit,
          targetExternalId: event.targetExternalId,
          newContent: event.newContent,
          editedAt: event.editedAt,
        }),
      })
      const text = await res.text()
      console.log(
        `[wa-gateway] [${this.sessionId}] [DEBUG] API webhook responded [${res.status}]: ${text}`,
      )
    } catch (err) {
      console.error(
        `[wa-gateway] [${this.sessionId}] [DEBUG] Failed to forward inbound message to API:`,
        (err as Error).message,
      )
    }

    if (this.redisPublisher) {
      await this.redisPublisher.publishInboundMessage(event).catch(() => {})
    }

    this.handlers?.onMessageReceived?.(event)
    return event
  }

  emitConnected(details?: Record<string, unknown>): void {
    this.status = 'connected'
    this.currentQr = null
    this.shouldReconnect = true

    const userObj = details?.user as { id?: string } | undefined
    if (userObj?.id) {
      const raw = userObj.id.split('@')[0].split(':')[0]
      this.phoneNumber = raw.startsWith('+') ? raw : `+${raw}`
    }

    this.handlers?.onStatusChange?.(this.status, details)
  }

  emitDisconnect(reason?: number): void {
    this.status = mapDisconnectReasonToStatus(reason)
    this.currentQr = null
    this.phoneNumber = null
    if (reason === DisconnectReason.loggedOut) {
      this.shouldReconnect = false
    }
    this.handlers?.onStatusChange?.(this.status, { reason })
  }

  async disconnect(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = undefined
    }
    this.shouldReconnect = false
    this.status = 'disconnected'
    this.currentQr = null
    this.phoneNumber = null
    if (this.socket && typeof this.socket.end === 'function') {
      try {
        this.socket.end(undefined)
      } catch {
        // Socket already closed
      }
    }
    this.handlers?.onStatusChange?.(this.status)
  }

  async startSocket(authDir?: string): Promise<void> {
    const sessionDir = authDir || `./data/sessions/${this.sessionId}`
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

    if (this.channelId || this.inboxId) {
      try {
        const { writeFileSync, existsSync, mkdirSync } = await import('node:fs')
        const { join } = await import('node:path')
        if (!existsSync(sessionDir)) {
          mkdirSync(sessionDir, { recursive: true })
        }
        writeFileSync(
          join(sessionDir, 'meta.json'),
          JSON.stringify({
            sessionId: this.sessionId,
            channelId: this.channelId,
            inboxId: this.inboxId,
          }),
        )
      } catch {
        // Ignore file write errors
      }
    }

    if (state.creds?.me?.id) {
      const raw = state.creds.me.id.split('@')[0].split(':')[0]
      this.phoneNumber = raw.startsWith('+') ? raw : `+${raw}`
      console.log(
        `[wa-gateway] [${this.sessionId}] [DEBUG] Phone number pre-loaded from creds: ${this.phoneNumber}`,
      )
    }

    const { version } = await fetchLatestBaileysVersion()
    console.log(
      `[wa-gateway] [${this.sessionId}] [DEBUG] Starting Baileys socket with version ${version.join('.')}`,
    )

    const sock = makeWASocket({
      version,
      auth: state,
      browser: DEFAULT_BROWSER,
      logger: pino({ level: 'debug' }),
      printQRInTerminal: false,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      fireInitQueries: false,
      markOnlineOnConnect: true,
    })

    this.socket = sock

    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flushInterval = setInterval(() => {
      try {
        if (sock.ev && typeof sock.ev.isBuffering === 'function' && sock.ev.isBuffering()) {
          sock.ev.flush()
        }
      } catch {
        // Ignore flush error
      }
    }, 2000)

    if (sock.ws) {
      // biome-ignore lint/suspicious/noExplicitAny: raw binary node
      sock.ws.on('CB:message', (node: any) => {
        console.log(
          `[wa-gateway] [${this.sessionId}] [RAW-WS CB:message] from=${node?.attrs?.from}, id=${node?.attrs?.id}, type=${node?.attrs?.type}, notify=${node?.attrs?.notify}, sender_pn=${node?.attrs?.sender_pn}`,
        )
        // Immediate buffer flush to prevent message delays
        setTimeout(() => {
          try {
            sock.ev?.flush?.()
          } catch {
            // Ignore flush error
          }
        }, 300)
      })
      // biome-ignore lint/suspicious/noExplicitAny: raw binary node
      sock.ws.on('CB:receipt', (node: any) => {
        console.log(
          `[wa-gateway] [${this.sessionId}] [RAW-WS CB:receipt] from=${node?.attrs?.from}, id=${node?.attrs?.id}`,
        )
      })
      // biome-ignore lint/suspicious/noExplicitAny: raw binary node
      sock.ws.on('CB:notification', (node: any) => {
        console.log(
          `[wa-gateway] [${this.sessionId}] [RAW-WS CB:notification] from=${node?.attrs?.from}, type=${node?.attrs?.type}`,
        )
      })
    }

    sock.ev.process(async (events) => {
      // 1. Dump any received events
      for (const eventName of Object.keys(events)) {
        if (eventName !== 'creds.update') {
          console.log(`[wa-gateway] [${this.sessionId}] [DUMP EVENT] ${eventName}`)
        }
      }

      // 2. Credentials updated
      if (events['creds.update']) {
        console.log(`[wa-gateway] [${this.sessionId}] [DEBUG] Credentials updated and saved`)
        await saveCreds()
      }

      // 3. Connection update
      if (events['connection.update']) {
        const update = events['connection.update']
        const { connection, lastDisconnect, qr } = update
        // biome-ignore lint/suspicious/noExplicitAny: error extraction
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode
        console.log(
          `[wa-gateway] [${this.sessionId}] [DEBUG] connection.update: status=${connection}, qr=${Boolean(qr)}, statusCode=${statusCode}`,
        )

        if (qr) {
          await this.emitQr(qr)
        }

        if (connection === 'open') {
          console.log(
            `[wa-gateway] [${this.sessionId}] [DEBUG] Connection OPEN! Authenticated as: ${sock.user?.id}`,
          )
          this.emitConnected({ user: sock.user })
        }

        if (connection === 'close') {
          console.log(
            `[wa-gateway] [${this.sessionId}] [DEBUG] Connection CLOSED. Reason code: ${statusCode}`,
          )
          if (this.flushInterval) {
            clearInterval(this.flushInterval)
            this.flushInterval = undefined
          }
          this.emitDisconnect(statusCode)

          const isTemporaryQr = this.sessionId.startsWith('baileys-qr-')
          const isQrTimeout = statusCode === 408 || statusCode === DisconnectReason.timedOut

          if (
            this.shouldReconnect &&
            statusCode !== DisconnectReason.loggedOut &&
            !(isTemporaryQr && isQrTimeout)
          ) {
            console.log(`[wa-gateway] [${this.sessionId}] [DEBUG] Scheduling reconnect in 3s...`)
            setTimeout(() => {
              this.startSocket(authDir).catch((err) => {
                console.error(`Reconnection error for session ${this.sessionId}:`, err)
              })
            }, 3000)
          }
        }
      }

      // 4. Messages Upsert
      if (events['messages.upsert']) {
        const upsert = events['messages.upsert']

        // Asynchronously dump messages to daily JSONL file for forensic and R&D analysis
        rawMessageDumper.dumpMessages(this.sessionId, upsert.messages).catch((err) => {
          console.error(`[wa-gateway] [${this.sessionId}] Failed to dump raw messages:`, err)
        })

        console.log(
          `[wa-gateway] [${this.sessionId}] [DUMP messages.upsert] RAW:\n`,
          JSON.stringify(upsert, null, 2),
        )

        for (const msg of upsert.messages) {
          // biome-ignore lint/suspicious/noExplicitAny: inspect content keys
          const msgKeys = Object.keys((msg as any).message || {}).join(',')
          console.log(
            `[wa-gateway] [${this.sessionId}] [DEBUG] Message: id=${msg.key?.id}, remoteJid=${msg.key?.remoteJid}, fromMe=${msg.key?.fromMe}, pushName=${msg.pushName}, keys=[${msgKeys}]`,
          )

          // biome-ignore lint/suspicious/noExplicitAny: inspect key
          const anyMsg = msg as any
          const effectiveSenderJid = anyMsg?.key?.remoteJidAlt || anyMsg?.key?.remoteJid || ''
          const myCleanNumber = this.phoneNumber ? this.phoneNumber.replace(/[^0-9]/g, '') : null
          const remoteCleanNumber = effectiveSenderJid.split('@')[0].split(':')[0]
          const isSelfChat = Boolean(myCleanNumber && remoteCleanNumber === myCleanNumber)

          if (!msg.key.fromMe || isSelfChat) {
            console.log(
              `[wa-gateway] [${this.sessionId}] [DEBUG] Message qualifies as inbound (fromMe=${msg.key.fromMe}, isSelfChat=${isSelfChat})`,
            )
            await this.handleInboundMessage(msg, false)
          } else {
            // Outgoing message (fromMe === true, not self-chat)
            const msgId = msg.key?.id
            if (msgId && outboundTracker.consume(msgId)) {
              console.log(
                `[wa-gateway] [${this.sessionId}] [DEBUG] Skipping outgoing message (id=${msgId} was dispatched by Xatxoot dashboard)`,
              )
            } else {
              console.log(
                `[wa-gateway] [${this.sessionId}] [DEBUG] Echo outgoing message detected from physical device! id=${msgId}`,
              )
              await this.handleInboundMessage(msg, true)
            }
          }
        }
      }

      // 5. Messages Update
      if (events['messages.update']) {
        console.log(
          `[wa-gateway] [${this.sessionId}] [DUMP messages.update] RAW:\n`,
          JSON.stringify(events['messages.update'], null, 2),
        )
      }

      // 6. Message Receipt Update
      if (events['message-receipt.update']) {
        console.log(
          `[wa-gateway] [${this.sessionId}] [DUMP message-receipt.update] RAW:\n`,
          JSON.stringify(events['message-receipt.update'], null, 2),
        )
      }
    })
  }
}
