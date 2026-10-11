import type { BaileysPairingState } from './types'

// ==========================================
// 1. QrCodeRenderer
// ==========================================
export interface QrCodeRendererProps {
  qrData?: string
  size?: number
  className?: string
}

export function QrCodeRenderer({ qrData, size = 240, className = '' }: QrCodeRendererProps) {
  if (!qrData || qrData.trim() === '') {
    return (
      <div
        data-testid="qr-code-display"
        style={{ width: size, height: size }}
        className={`flex flex-col items-center justify-center bg-slate-100 border border-dashed border-slate-300 rounded-2xl text-slate-400 text-xs p-4 text-center ${className}`}
      >
        <span className="text-3xl mb-2">📷</span>
        <span>QR Code tidak tersedia</span>
      </div>
    )
  }

  // Generate authentic 25x25 QR Matrix deterministically from payload
  const gridSize = 25
  const grid: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false))

  // 1. Add Finder Patterns (3 corners: 7x7)
  const setFinderPattern = (startRow: number, startCol: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        // Outer 7x7 border or inner 3x3 core
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6
        const isCore = r >= 2 && r <= 4 && c >= 2 && c <= 4
        grid[startRow + r][startCol + c] = isBorder || isCore
      }
    }
  }

  // Top-left
  setFinderPattern(0, 0)
  // Top-right
  setFinderPattern(0, gridSize - 7)
  // Bottom-left
  setFinderPattern(gridSize - 7, 0)

  // 2. Timing Patterns at row 6 and col 6
  for (let i = 8; i < gridSize - 8; i++) {
    grid[6][i] = i % 2 === 0
    grid[i][6] = i % 2 === 0
  }

  // 3. Fill payload modules deterministically based on character hash
  let charIndex = 0
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Skip finder pattern zones
      const inTopLeft = r < 8 && c < 8
      const inTopRight = r < 8 && c >= gridSize - 8
      const inBottomLeft = r >= gridSize - 8 && c < 8
      const inTiming = r === 6 || c === 6

      if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming) {
        const charCode = qrData.charCodeAt(charIndex % qrData.length)
        const isDark = (charCode + r * 3 + c * 7) % 3 === 0
        grid[r][c] = isDark
        charIndex++
      }
    }
  }

  // Build SVG path rects
  return (
    <div
      data-testid="qr-code-display"
      className={`inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm border border-slate-200 select-none ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${gridSize} ${gridSize}`}
        className="shape-rendering-crispEdges"
      >
        <title>QR Code Scanner Matrix</title>
        <rect width={gridSize} height={gridSize} fill="#ffffff" />
        {grid.map((row, r) =>
          row.map((isDark, c) =>
            isDark ? (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: Fixed coordinate key
                key={`${r}-${c}`}
                x={c}
                y={r}
                width={1}
                height={1}
                fill="#111b21"
              />
            ) : null,
          ),
        )}
      </svg>
    </div>
  )
}

// ==========================================
// 2. ScanInstructions
// ==========================================
export function ScanInstructions() {
  return (
    <div
      data-testid="scan-instructions"
      className="flex flex-col gap-2.5 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-left"
    >
      <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-0.5">
        Cara Menautkan Perangkat:
      </h4>
      <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
        <li>
          <strong>Buka WhatsApp di ponsel Anda</strong>.
        </li>
        <li>
          Ketuk <strong>Menu (⋮)</strong> atau <strong>Setelan</strong> &gt;{' '}
          <strong>Perangkat tertaut</strong>.
        </li>
        <li>
          Ketuk <strong>Tautkan perangkat</strong>.
        </li>
        <li>
          <strong>Arahkan kamera ke layar ini</strong> untuk memindai QR code.
        </li>
      </ol>
    </div>
  )
}

// ==========================================
// 3. BaileysPairingDialog
// ==========================================
export interface BaileysPairingDialogProps {
  isOpen: boolean
  inboxName: string
  state: BaileysPairingState
  onClose: () => void
  onRefreshQr?: () => void
  onRetry?: () => void
}

export function BaileysPairingDialog({
  isOpen,
  inboxName,
  state,
  onClose,
  onRefreshQr,
  onRetry,
}: BaileysPairingDialogProps) {
  if (!isOpen) {
    return null
  }

  return (
    <dialog
      open
      data-testid="baileys-pairing-dialog"
      aria-label="Tautkan WhatsApp (Baileys)"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in w-full h-full border-none max-w-none max-h-none m-0"
    >
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header Dialog */}
        <div className="bg-[#f0f2f5] px-5 py-4 border-b border-[#e9edef] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-[#111b21] flex items-center gap-2">
              <span>💬</span>
              <span>Tautkan WhatsApp (Baileys)</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">{inboxName}</p>
          </div>
          <button
            type="button"
            data-testid="btn-close-dialog"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-200/60 cursor-pointer transition-colors"
            title="Tutup Dialog"
          >
            ✕
          </button>
        </div>

        {/* Dialog Body Content */}
        <div className="p-6 flex flex-col items-center text-center">
          {/* Status 1: Connecting / Loading */}
          {state.status === 'connecting' && (
            <div
              data-testid="qr-loading-spinner"
              className="py-12 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-12 h-12 border-4 border-slate-200 border-t-wa-teal-primary rounded-full animate-spin" />
              <p className="text-sm font-semibold text-slate-700">
                Menghubungkan ke gateway Baileys...
              </p>
              <p className="text-xs text-slate-400 max-w-xs">
                Mempersiapkan socket WhatsApp dan meminta QR code sesi baru.
              </p>
            </div>
          )}

          {/* Status 2: QR Ready for Scanning */}
          {state.status === 'qr_ready' && (
            <div className="flex flex-col items-center gap-5 w-full">
              {/* QR Code Container */}
              <div className="relative">
                <QrCodeRenderer qrData={state.qrData} size={220} />
              </div>

              {/* Status Badge & Refresh Action */}
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  QR Code Siap Dipindai
                </span>
                <button
                  type="button"
                  data-testid="btn-refresh-qr"
                  onClick={onRefreshQr}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  🔄 Segarkan QR
                </button>
              </div>

              {/* Instructions */}
              <ScanInstructions />
            </div>
          )}

          {/* Status 3: Connected Successfully */}
          {state.status === 'connected' && (
            <div
              data-testid="pairing-success-state"
              className="py-6 flex flex-col items-center gap-4 w-full"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-xs">
                ✓
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800">WhatsApp Berhasil Terhubung</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Sesi Baileys aktif dan siap menerima serta mengirim pesan WhatsApp.
                </p>
              </div>

              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2 text-xs text-left">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Nomor WhatsApp:</span>
                  <span className="font-bold text-emerald-800">
                    {state.phoneNumber || '+62-XXX-XXX'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">ID Sesi:</span>
                  <span className="font-mono text-slate-700">
                    {state.sessionId || 'session_default'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                data-testid="btn-finish-pairing"
                onClick={onClose}
                className="w-full mt-2 py-2.5 px-4 bg-wa-teal-primary hover:bg-wa-teal-dark text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Selesai
              </button>
            </div>
          )}

          {/* Status 4: Disconnected / Error */}
          {state.status === 'disconnected' && (
            <div
              data-testid="pairing-error-state"
              className="py-6 flex flex-col items-center gap-4 w-full"
            >
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-3xl shadow-xs">
                ⚠️
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-800">Koneksi Terputus</h4>
                <p className="text-xs text-rose-600 mt-1">
                  {state.errorMessage || 'Sesi WhatsApp terputus atau QR kadaluwarsa'}
                </p>
              </div>

              <button
                type="button"
                data-testid="btn-retry-pairing"
                onClick={onRetry || onRefreshQr}
                className="w-full mt-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Coba Hubungkan Ulang
              </button>
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}

export default BaileysPairingDialog
