export type BaileysConnectionStatus = 'connecting' | 'qr_ready' | 'connected' | 'disconnected'

export interface BaileysPairingState {
  status: BaileysConnectionStatus
  qrData?: string
  qrExpiresAt?: string
  phoneNumber?: string
  sessionId?: string
  errorMessage?: string
}
