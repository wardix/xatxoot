import type { UserFacingSocketConfig } from '@whiskeysockets/baileys'
import pino from 'pino'
import type { SocketConfigOptions } from '../types/connection'

export const DEFAULT_BROWSER: [string, string, string] = ['Xatxoot', 'Chrome', '1.0.0']

export function createSocketConfig(options: SocketConfigOptions): Partial<UserFacingSocketConfig> {
  const logger = pino({ level: options.loggerLevel || 'silent' })

  return {
    auth: options.authState,
    browser: options.browser || DEFAULT_BROWSER,
    printQRInTerminal: options.printQRInTerminal ?? false,
    syncFullHistory: options.syncFullHistory ?? false,
    logger,
  }
}
