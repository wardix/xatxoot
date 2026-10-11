import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('WhatsApp Unofficial Gateway Baileys Multi-Device (Task 1.11)', () => {
  const gatewayDir = join(import.meta.dir, '..', 'apps', 'wa-gateway')
  const pkgPath = join(gatewayDir, 'package.json')
  const tsconfigPath = join(gatewayDir, 'tsconfig.json')

  it('should have apps/wa-gateway package structure targeting Node.js LTS v20 runtime', () => {
    expect(existsSync(pkgPath)).toBe(true)
    expect(existsSync(tsconfigPath)).toBe(true)

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.name).toBe('@xatxoot/wa-gateway')
    expect(pkg.engines).toBeDefined()
    expect(pkg.engines.node).toContain('20')
    expect(pkg.dependencies['@whiskeysockets/baileys']).toBeDefined()
    expect(pkg.dependencies.pino).toBeDefined()
  })

  it('should export BaileysConnectionManager and connection utilities', async () => {
    const {
      BaileysConnectionManager,
      baileysConnectionManager,
      createSocketConfig,
      mapDisconnectReasonToStatus,
      DisconnectReason,
    } = await import('../apps/wa-gateway/src/index')

    expect(BaileysConnectionManager).toBeDefined()
    expect(baileysConnectionManager).toBeDefined()
    expect(DisconnectReason).toBeDefined()
    expect(typeof createSocketConfig).toBe('function')
    expect(typeof mapDisconnectReasonToStatus).toBe('function')
  })

  it('should generate default Baileys socket config with Xatxoot browser tuple', async () => {
    const { createSocketConfig } = await import('../apps/wa-gateway/src/index')

    const dummyAuthState = {
      creds: {} as unknown as Record<string, unknown>,
      keys: { get: async () => ({}), set: async () => {} } as unknown as Record<string, unknown>,
    } as unknown as Parameters<typeof createSocketConfig>[0]['authState']

    const config = createSocketConfig({
      sessionId: 'session_test_1',
      authState: dummyAuthState,
      printQRInTerminal: false,
    })

    expect(config.browser).toBeDefined()
    expect(config.browser?.[0]).toBe('Xatxoot')
    expect(config.browser?.[1]).toBe('Chrome')
    expect(config.printQRInTerminal).toBe(false)
    expect(config.auth).toBe(dummyAuthState)
  })

  it('should map DisconnectReason correctly to connection status', async () => {
    const { mapDisconnectReasonToStatus, DisconnectReason } = await import(
      '../apps/wa-gateway/src/index'
    )

    // DisconnectReason.loggedOut (401) -> logged_out
    expect(mapDisconnectReasonToStatus(DisconnectReason.loggedOut)).toBe('logged_out')

    // DisconnectReason.restartRequired (515) -> disconnected (reconnectable)
    expect(mapDisconnectReasonToStatus(DisconnectReason.restartRequired)).toBe('disconnected')

    // DisconnectReason.timedOut (408) -> disconnected
    expect(mapDisconnectReasonToStatus(DisconnectReason.timedOut)).toBe('disconnected')

    // DisconnectReason.connectionLost (408 / generic) -> disconnected
    expect(mapDisconnectReasonToStatus(DisconnectReason.connectionLost)).toBe('disconnected')

    // Unknown reason -> disconnected
    expect(mapDisconnectReasonToStatus(undefined)).toBe('disconnected')
  })

  it('should manage multi-device sessions lifecycle (init, get, disconnect, delete)', async () => {
    const { BaileysConnectionManager } = await import('../apps/wa-gateway/src/index')

    const manager = new BaileysConnectionManager()
    const sessionId = 'test_session_multi_device'

    let lastStatus: string | null = null
    let lastQr: string | null = null

    const session = await manager.createSession({
      sessionId,
      options: { printQRInTerminal: false },
      handlers: {
        onStatusChange: (status) => {
          lastStatus = status
        },
        onQrCode: (qr) => {
          lastQr = qr
        },
      },
    })

    expect(session).toBeDefined()
    expect(session.sessionId).toBe(sessionId)
    expect(session.status).toBe('connecting')
    expect(manager.hasSession(sessionId)).toBe(true)
    expect(manager.getSession(sessionId)).toBe(session)

    // Simulate QR code event
    session.emitQr('mock_baileys_qr_code_string_123')
    expect(session.status).toBe('pairing')
    expect(lastStatus).toBe('pairing')
    expect(lastQr).toBe('mock_baileys_qr_code_string_123')

    // Simulate connection open event
    session.emitConnected({ user: { id: '6281234567890:1@s.whatsapp.net', name: 'Xatxoot WA' } })
    expect(session.status).toBe('connected')
    expect(lastStatus).toBe('connected')

    // Disconnect session
    await manager.disconnectSession(sessionId)
    expect(session.status).toBe('disconnected')
    expect(lastStatus).toBe('disconnected')

    // Delete session
    await manager.deleteSession(sessionId)
    expect(manager.hasSession(sessionId)).toBe(false)
    expect(manager.getSession(sessionId)).toBeUndefined()
  })

  it('should handle loggedOut event and prevent automatic reconnection', async () => {
    const { BaileysConnectionManager, DisconnectReason } = await import(
      '../apps/wa-gateway/src/index'
    )

    const manager = new BaileysConnectionManager()
    const sessionId = 'test_session_logout'

    const statusUpdates: string[] = []

    const session = await manager.createSession({
      sessionId,
      handlers: {
        onStatusChange: (status) => {
          statusUpdates.push(status)
        },
      },
    })

    // Simulate disconnect with loggedOut reason
    session.emitDisconnect(DisconnectReason.loggedOut)
    expect(session.status).toBe('logged_out')
    expect(session.shouldReconnect).toBe(false)
    expect(statusUpdates).toContain('logged_out')
  })
})
