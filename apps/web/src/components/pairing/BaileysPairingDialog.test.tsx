import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { BaileysPairingDialog, QrCodeRenderer, ScanInstructions } from './BaileysPairingDialog'
import type { BaileysPairingState } from './types'

describe('Baileys QR Pairing Dialog Component (Task 1.27 - apps/web)', () => {
  const mockQrString = '2@fK7x8Y1...sample-baileys-qr-data'

  describe('QrCodeRenderer', () => {
    it('should render SVG QR code matrix from QR string payload', () => {
      const html = renderToStaticMarkup(<QrCodeRenderer qrData={mockQrString} size={240} />)
      expect(html).toContain('data-testid="qr-code-display"')
      expect(html).toContain('<svg')
      expect(html).toContain('width="240"')
      expect(html).toContain('height="240"')
    })

    it('should render fallback placeholder when qrData is empty', () => {
      const html = renderToStaticMarkup(<QrCodeRenderer qrData="" size={240} />)
      expect(html).toContain('data-testid="qr-code-display"')
      expect(html).toContain('QR Code tidak tersedia')
    })
  })

  describe('ScanInstructions', () => {
    it('should render WhatsApp Web step-by-step scan guidance', () => {
      const html = renderToStaticMarkup(<ScanInstructions />)
      expect(html).toContain('data-testid="scan-instructions"')
      expect(html).toContain('Buka WhatsApp di ponsel Anda')
      expect(html).toContain('Perangkat tertaut')
      expect(html).toContain('Tautkan perangkat')
      expect(html).toContain('Arahkan kamera ke layar ini')
    })
  })

  describe('BaileysPairingDialog Modal Lifecycle', () => {
    it('should NOT render visible dialog when isOpen is false', () => {
      const state: BaileysPairingState = {
        status: 'qr_ready',
        qrData: mockQrString,
      }

      const html = renderToStaticMarkup(
        <BaileysPairingDialog
          isOpen={false}
          inboxName="WhatsApp Layanan CS"
          state={state}
          onClose={() => {}}
          onRefreshQr={() => {}}
        />,
      )

      expect(html).not.toContain('data-testid="baileys-pairing-dialog"')
    })

    it('should render dialog with live QR code and instructions when status is qr_ready', () => {
      const state: BaileysPairingState = {
        status: 'qr_ready',
        qrData: mockQrString,
      }

      const html = renderToStaticMarkup(
        <BaileysPairingDialog
          isOpen={true}
          inboxName="WhatsApp Layanan CS"
          state={state}
          onClose={() => {}}
          onRefreshQr={() => {}}
        />,
      )

      expect(html).toContain('data-testid="baileys-pairing-dialog"')
      expect(html).toContain('Tautkan WhatsApp (Baileys)')
      expect(html).toContain('WhatsApp Layanan CS')
      expect(html).toContain('data-testid="btn-close-dialog"')
      expect(html).toContain('data-testid="qr-code-display"')
      expect(html).toContain('data-testid="scan-instructions"')
      expect(html).toContain('data-testid="btn-refresh-qr"')
      expect(html).toContain('QR Code Siap')
    })

    it('should render loading spinner when status is connecting or loading', () => {
      const state: BaileysPairingState = {
        status: 'connecting',
      }

      const html = renderToStaticMarkup(
        <BaileysPairingDialog
          isOpen={true}
          inboxName="WhatsApp Layanan CS"
          state={state}
          onClose={() => {}}
          onRefreshQr={() => {}}
        />,
      )

      expect(html).toContain('data-testid="qr-loading-spinner"')
      expect(html).toContain('Menghubungkan ke gateway Baileys')
    })

    it('should render success view with phone number and session ID when connected', () => {
      const state: BaileysPairingState = {
        status: 'connected',
        phoneNumber: '+6281234567890',
        sessionId: 'session_inbox_01',
      }

      const html = renderToStaticMarkup(
        <BaileysPairingDialog
          isOpen={true}
          inboxName="WhatsApp Layanan CS"
          state={state}
          onClose={() => {}}
          onRefreshQr={() => {}}
        />,
      )

      expect(html).toContain('data-testid="pairing-success-state"')
      expect(html).toContain('WhatsApp Berhasil Terhubung')
      expect(html).toContain('+6281234567890')
      expect(html).toContain('session_inbox_01')
      expect(html).toContain('data-testid="btn-finish-pairing"')
    })

    it('should render error view with retry button when disconnected or error occurs', () => {
      const state: BaileysPairingState = {
        status: 'disconnected',
        errorMessage: 'Sesi WhatsApp terputus atau QR kadaluwarsa',
      }

      const html = renderToStaticMarkup(
        <BaileysPairingDialog
          isOpen={true}
          inboxName="WhatsApp Layanan CS"
          state={state}
          onClose={() => {}}
          onRefreshQr={() => {}}
        />,
      )

      expect(html).toContain('data-testid="pairing-error-state"')
      expect(html).toContain('Sesi WhatsApp terputus')
      expect(html).toContain('data-testid="btn-retry-pairing"')
    })
  })
})
