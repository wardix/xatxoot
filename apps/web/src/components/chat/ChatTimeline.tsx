import { Fragment, useState } from 'react'
import {
  TicketLifecyclePopover,
  TicketOpenedPill,
  TicketResolvedPill,
} from './TicketLifecyclePills'
import { TicketNotePopover } from './TicketNotePopover'
import type { DeliveryStatus, MessageMention, TimelineMessage } from './types'

// ==========================================
// WhatsApp Text Formatter (*bold*, _italic_, ~strike~, ```code```, @mentions)
// ==========================================
export interface FormatWhatsAppTextOptions {
  mentions?: MessageMention[]
  isMentioningMe?: boolean
}

export function formatWhatsAppText(text: string, options?: FormatWhatsAppTextOptions): string {
  if (!text) return ''

  // Step 1: Escape HTML to avoid XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // Step 2: Format mentions (@NamaKontak or @Anda)
  if (options?.mentions && options.mentions.length > 0) {
    for (const m of options.mentions) {
      const isMe = Boolean(
        m.isMe ||
          (options.isMentioningMe &&
            (options.mentions.length === 1 || m.name === 'Anda' || m.name === 'CS Admin')),
      )
      const rawJidId = m.jid.split('@')[0].split(':')[0]
      const rawPhone = m.phone ? m.phone.replace(/[^0-9]/g, '') : undefined
      const tooltip = m.phone || m.jid

      const badge = isMe
        ? `<span data-testid="mention-me-badge" class="inline-flex items-center font-bold px-1.5 py-0.5 rounded text-wa-teal dark:text-wa-teal-light bg-emerald-500/15 border border-emerald-500/20 shadow-2xs cursor-pointer select-none" title="${tooltip}">@Anda</span>`
        : `<span data-testid="mention-badge" class="inline-flex items-center font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer select-none" title="${tooltip}">@${m.name || m.phone || rawJidId}</span>`

      if (rawJidId) {
        escaped = escaped.replaceAll(`@${rawJidId}`, badge)
      }
      if (rawPhone && rawPhone !== rawJidId) {
        escaped = escaped.replaceAll(`@${rawPhone}`, badge)
      }
    }
  }

  // Step 3: Format monospace ```code```
  escaped = escaped.replace(
    /```([^`]+)```/g,
    '<code class="bg-black/10 px-1 py-0.5 rounded font-mono text-xs">$1</code>',
  )

  // Step 4: Format bold *text*
  escaped = escaped.replace(
    /(^|[^\w])\*([^\s*][^*]*?[^\s*]|[^\s*])\*(?=[^\w]|$)/g,
    '$1<strong>$2</strong>',
  )

  // Step 5: Format italic _text_
  escaped = escaped.replace(/(^|[^\w])_([^\s_][^_]*?[^\s_]|[^\s_])_(?=[^\w]|$)/g, '$1<em>$2</em>')

  // Step 6: Format strikethrough ~text~
  escaped = escaped.replace(/(^|[^\w])~([^\s~][^~]*?[^\s~]|[^\s~])~(?=[^\w]|$)/g, '$1<del>$2</del>')

  return escaped
}

// ==========================================
// DeliveryStatusTick (Clock, Sent, Delivered, Read, Failed)
// ==========================================
export interface DeliveryStatusTickProps {
  status?: DeliveryStatus
  className?: string
}

export function DeliveryStatusTick({ status = 'sent', className = '' }: DeliveryStatusTickProps) {
  switch (status) {
    case 'pending':
      return (
        <span
          data-testid="delivery-status"
          data-status="pending"
          title="Menunggu pengiriman"
          className={`inline-flex items-center text-[10px] text-slate-400 select-none ${className}`}
        >
          🕒
        </span>
      )
    case 'sent':
      return (
        <span
          data-testid="delivery-status"
          data-status="sent"
          title="Terkirim"
          className={`inline-flex items-center text-[11px] text-slate-400 font-bold select-none ${className}`}
        >
          ✓
        </span>
      )
    case 'delivered':
      return (
        <span
          data-testid="delivery-status"
          data-status="delivered"
          title="Diterima"
          className={`inline-flex items-center text-[11px] text-slate-400 font-bold tracking-[-3px] mr-1 select-none ${className}`}
        >
          ✓✓
        </span>
      )
    case 'read':
      return (
        <span
          data-testid="delivery-status"
          data-status="read"
          title="Dibaca"
          className={`inline-flex items-center text-[11px] text-wa-tick-blue font-bold tracking-[-3px] mr-1 select-none ${className}`}
        >
          ✓✓
        </span>
      )
    case 'failed':
      return (
        <span
          data-testid="delivery-status"
          data-status="failed"
          title="Gagal terkirim"
          className={`inline-flex items-center text-[11px] text-rose-500 font-bold select-none ${className}`}
        >
          !
        </span>
      )
    default:
      return null
  }
}

// ==========================================
// DateSeparatorPill (Floating Centered Date Pill)
// ==========================================
export interface DateSeparatorPillProps {
  dateText: string
}

export function DateSeparatorPill({ dateText }: DateSeparatorPillProps) {
  return (
    <div className="flex justify-center my-3 select-none">
      <span
        data-testid="date-separator-pill"
        className="px-3.5 py-1 bg-white/90 backdrop-blur-xs text-[11px] font-semibold text-slate-600 uppercase tracking-wider rounded-lg shadow-2xs border border-slate-200/60"
      >
        {dateText}
      </span>
    </div>
  )
}

// ==========================================
// TicketSeparatorPill (Visual Boundary Between Tickets)
// ==========================================
export interface TicketSeparatorPillProps {
  ticketNumber?: string | number
  text?: string
  timestamp?: string
  dateText?: string
  openedAt?: string
  internalNote?: string | null
  internalNoteUpdatedAt?: string | null
  internalNoteUpdatedBy?: string | null
  onSaveInternalNote?: (note: string) => void | Promise<void>
}

export function TicketSeparatorPill({
  ticketNumber,
  text,
  timestamp,
  dateText,
  openedAt,
  internalNote,
  internalNoteUpdatedAt,
  internalNoteUpdatedBy,
  onSaveInternalNote,
}: TicketSeparatorPillProps) {
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  if (!text) {
    return (
      <TicketOpenedPill
        ticketNumber={ticketNumber}
        timestamp={timestamp}
        dateText={dateText}
        openedAt={openedAt}
        internalNote={internalNote}
        internalNoteUpdatedAt={internalNoteUpdatedAt}
        internalNoteUpdatedBy={internalNoteUpdatedBy}
        onSaveInternalNote={onSaveInternalNote}
      />
    )
  }

  const handleSaveNote = async (note: string) => {
    if (onSaveInternalNote) {
      try {
        setIsSaving(true)
        await onSaveInternalNote(note)
      } finally {
        setIsSaving(false)
        setIsNoteOpen(false)
      }
    } else {
      setIsNoteOpen(false)
    }
  }

  return (
    <div
      data-testid="ticket-separator-pill"
      className="flex items-center justify-center my-4 select-none px-4 relative"
    >
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsNoteOpen((prev) => !prev)}
          className="mx-3 px-3 py-1 bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-100/80 transition-colors"
          title={internalNote ? `Catatan: ${internalNote}` : 'Lihat / Tambah Catatan Internal'}
        >
          <span>🎫</span>
          <span>{text}</span>
          {internalNote && (
            <span
              data-testid="ticket-pill-note-badge"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold"
              title={`Catatan Internal: ${internalNote}`}
            >
              📌
            </span>
          )}
        </button>

        {isNoteOpen && (
          <TicketNotePopover
            isOpen={isNoteOpen}
            ticketNumber={ticketNumber}
            initialNote={internalNote}
            updatedAt={internalNoteUpdatedAt}
            updatedBy={internalNoteUpdatedBy}
            isSaving={isSaving}
            onSave={handleSaveNote}
            onClose={() => setIsNoteOpen(false)}
            onDelete={() => handleSaveNote('')}
          />
        )}
      </div>
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
    </div>
  )
}

// ==========================================
// ChatBubble (Incoming, Outgoing, Activity)
// ==========================================
export interface ChatBubbleProps {
  message: TimelineMessage
  onRetry?: (message: TimelineMessage) => void
  onReply?: (message: TimelineMessage) => void
  onForward?: (message: TimelineMessage) => void
}

export function ChatBubble({ message, onRetry, onReply, onForward }: ChatBubbleProps) {
  const [showAudit, setShowAudit] = useState(false)
  const isRevoked = Boolean(message.isDeletedBySender || message.status === 'deleted_by_sender')
  // biome-ignore lint/suspicious/noExplicitAny: quoted message resolution
  const quoted = message.replyTo || (message.contentAttributes as any)?.replyTo

  // Activity Pill (Status transisi tiket, assignment, lifecycle, dll)
  if (message.messageType === 'activity') {
    // biome-ignore lint/suspicious/noExplicitAny: lifecycle attributes
    const attrs = (message.contentAttributes as any) || {}
    const isResolved =
      attrs.eventType === 'ticket_resolved' ||
      message.content?.toLowerCase().includes('diselesaikan')
    const isOpened = attrs.eventType === 'ticket_opened'

    if (isResolved) {
      return (
        <TicketResolvedPill
          ticketNumber={attrs.ticketDisplayId || message.ticketDisplayId}
          resolvedBy={attrs.resolvedBy}
          timestamp={message.timestamp}
          durationText={attrs.durationText}
          openedAt={attrs.openedAt}
          resolvedAt={attrs.resolvedAt}
          durationMs={attrs.durationMs}
        />
      )
    }

    if (isOpened) {
      return (
        <TicketOpenedPill
          ticketNumber={attrs.ticketDisplayId || message.ticketDisplayId}
          timestamp={message.timestamp}
          dateText={message.dateGroup}
          openedAt={attrs.openedAt}
        />
      )
    }

    return (
      <div className="flex justify-center my-2 select-none px-4">
        <span
          data-testid="activity-pill"
          className="px-3.5 py-1.5 bg-wa-header-bg text-wa-text-muted text-xs font-medium rounded-lg shadow-2xs text-center border border-wa-border max-w-md flex items-center justify-center gap-1.5"
        >
          <span>ℹ️</span>
          <span>{message.content}</span>
        </span>
      </div>
    )
  }

  const isIncoming =
    message.messageType === 'incoming' ||
    message.senderType === 'contact' ||
    (message.messageType !== 'outgoing' &&
      message.senderType !== 'user' &&
      message.senderType !== 'bot')
  const isOutgoing =
    message.messageType === 'outgoing' ||
    message.senderType === 'user' ||
    message.senderType === 'bot'

  const isEcho = Boolean(
    message.isEcho ||
      message.contentAttributes?.echo ||
      message.contentAttributes?.source === 'whatsapp_mobile' ||
      message.senderName === 'WhatsApp HP',
  )
  const isBot =
    !isEcho && (message.senderType === 'bot' || message.senderName?.toLowerCase().includes('bot'))
  const isMentioningMe = Boolean(
    message.isMentioningMe ||
      (message.contentAttributes as Record<string, unknown> | undefined)?.isMentioningMe,
  )
  const effectiveMediaUrl =
    message.mediaUrl ||
    ((message.contentAttributes as Record<string, unknown> | undefined)?.mediaUrl as
      | string
      | undefined) ||
    (Array.isArray(message.attachments) && message.attachments[0]?.fileUrl) ||
    undefined

  const tooltipText = isEcho
    ? message.timestamp
      ? `Disinkronkan dari Aplikasi WhatsApp HP pada ${message.timestamp}`
      : 'Disinkronkan dari Aplikasi WhatsApp HP'
    : isBot
      ? message.timestamp
        ? `Dikirim oleh ${message.senderName || 'Bot Otomasi'} pada ${message.timestamp}`
        : `Dikirim oleh ${message.senderName || 'Bot Otomasi'}`
      : message.timestamp
        ? `Dikirim oleh ${message.senderName || 'Agen CS'} via Dashboard pada ${message.timestamp}`
        : `Dikirim oleh ${message.senderName || 'Agen CS'} via Dashboard`

  return (
    <div
      data-testid={isIncoming ? 'chat-bubble-incoming' : 'chat-bubble-outgoing'}
      className={`flex items-center gap-1.5 ${
        isIncoming ? 'justify-start pl-1.5 pr-4' : 'justify-end flex-row-reverse pr-1.5 pl-4'
      } my-1 select-text group`}
    >
      <div
        data-tail={isIncoming ? 'incoming' : 'outgoing'}
        className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl px-3.5 pt-2 pb-1.5 shadow-2xs ${
          isIncoming
            ? 'bg-wa-bubble-in text-wa-text-primary rounded-tl-xs border border-black/5'
            : isEcho
              ? 'bg-wa-bubble-out text-wa-text-primary rounded-tr-xs border border-amber-300'
              : 'bg-wa-bubble-out text-wa-text-primary rounded-tr-xs border border-emerald-900/5'
        } ${isMentioningMe ? 'ring-2 ring-emerald-500/40' : ''}`}
      >
        {/* Mentioned Highlight Badge */}
        {isMentioningMe && (
          <div
            data-testid="chat-bubble-mention-highlight"
            className="absolute -top-2.5 -right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950 border border-amber-500/30 shadow-2xs select-none"
            title="Anda di-mention dalam pesan ini"
          >
            <span>@Anda</span>
          </div>
        )}
        {/* WhatsApp-style Tail SVG */}
        {isIncoming ? (
          <svg
            className="absolute top-0 -left-2 w-2.5 h-3 text-wa-bubble-in"
            viewBox="0 0 8 13"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M1.533 3.568L8 12.186V0H2.812C1.042 0 .149 2.132 1.533 3.568z" />
          </svg>
        ) : (
          <svg
            className="absolute top-0 -right-2 w-2.5 h-3 text-wa-bubble-out"
            viewBox="0 0 8 13"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M5.188 0H0v12.186l6.467-8.618C7.851 2.132 6.958 0 5.188 0z" />
          </svg>
        )}

        {/* Sender Name for incoming group/contact */}
        {isIncoming &&
        (message.isGroup ||
          Boolean(message.participant) ||
          (message.contentAttributes as Record<string, unknown> | undefined)?.isGroup ||
          (message.contentAttributes as Record<string, unknown> | undefined)?.groupJid) ? (
          <div
            data-testid="group-participant-name"
            className="text-[11px] font-bold text-emerald-800 mb-0.5 leading-tight flex items-center gap-1.5"
          >
            <span>{message.participantName || message.senderName}</span>
            {message.participant && (
              <span className="text-[10px] font-normal text-slate-500">
                ({message.participant})
              </span>
            )}
          </div>
        ) : (
          isIncoming &&
          message.senderName && (
            <div className="text-[11px] font-bold text-emerald-800 mb-0.5 leading-tight">
              {message.senderName}
            </div>
          )
        )}

        {/* Forwarded Indicator Badge */}
        {(message.isForwarded ||
          (message.contentAttributes as Record<string, unknown> | undefined)?.isForwarded) && (
          <div
            data-testid="forwarded-indicator"
            className="flex items-center gap-1 text-[11px] italic text-slate-500 mb-1 leading-tight select-none"
          >
            <span>↪️</span>
            <span>Diteruskan</span>
          </div>
        )}

        {/* Sender Tag for outgoing messages (Agent vs WhatsApp Mobile HP vs Bot) */}
        {isOutgoing && (
          <div
            data-testid="outgoing-sender-tag"
            title={tooltipText}
            className="flex items-center gap-1 mb-1 leading-tight select-none"
          >
            {isEcho ? (
              <span
                data-testid="sender-badge-echo"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-900 font-semibold text-[10px] border border-amber-300"
              >
                <span>📱</span>
                <span>WhatsApp HP (Perangkat Fisik)</span>
              </span>
            ) : isBot ? (
              <span
                data-testid="sender-badge-bot"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-900 font-semibold text-[10px] border border-purple-300"
              >
                <span>🤖</span>
                <span>{message.senderName || 'Bot Otomasi'}</span>
              </span>
            ) : (
              <span
                data-testid="sender-badge-agent"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-wa-teal-dark"
              >
                <span>👤</span>
                <span>{message.senderName || 'Agen CS'}</span>
              </span>
            )}
          </div>
        )}

        {isRevoked ? (
          <div className="flex flex-col gap-1 pr-2 my-0.5">
            <div
              data-testid="message-revoked-placeholder"
              className="flex items-center gap-1.5 text-xs italic text-slate-500 font-normal select-none"
            >
              <span className="not-italic text-sm">🚫</span>
              <span>Pesan ini telah dihapus oleh pengirim</span>
            </div>
            {Boolean(message.revokedOriginalContent) && (
              <div className="mt-1">
                <button
                  type="button"
                  data-testid="toggle-audit-button"
                  onClick={() => setShowAudit((prev) => !prev)}
                  className="text-[10px] font-semibold text-emerald-700 hover:text-emerald-800 underline cursor-pointer select-none"
                >
                  {showAudit ? '[Tutup Pesan Asli (Audit)]' : '[Lihat Pesan Asli (Audit)]'}
                </button>
                {showAudit && (
                  <div
                    data-testid="revoked-audit-content"
                    className="mt-1.5 p-2 rounded bg-amber-50/90 border border-amber-200 text-xs text-amber-950 font-normal leading-relaxed break-words"
                  >
                    <div className="text-[10px] uppercase font-bold text-amber-800 mb-0.5">
                      Pesan Asli Sebelum Ditarik:
                    </div>
                    {message.revokedOriginalContent}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Quoted Message Box */}
            {quoted && (
              <div
                data-testid="quoted-message-box"
                className="mb-1.5 p-2 rounded-md bg-black/5 border-l-4 border-wa-teal-primary text-xs select-none"
              >
                <div className="font-semibold text-[11px] text-wa-teal-dark">
                  {quoted.senderName || 'Kutipan'}
                </div>
                <div className="text-slate-600 line-clamp-2 text-xs truncate">
                  {quoted.snippet || quoted.content || ''}
                </div>
              </div>
            )}

            {/* Media Attachments Preview */}
            {message.contentType === 'image' && effectiveMediaUrl && (
              <div className="mb-1.5 rounded-lg overflow-hidden bg-slate-100 max-h-64 border border-black/5">
                <img
                  data-testid="bubble-media-image"
                  src={effectiveMediaUrl}
                  alt={message.content || 'Lampiran Gambar'}
                  className="w-full h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                />
              </div>
            )}

            {message.contentType === 'document' && (
              <div className="mb-1.5 p-2 rounded-lg bg-black/5 flex items-center gap-2 border border-black/5">
                <span className="text-xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-wa-text-primary">
                    {message.fileName || 'Dokumen.pdf'}
                  </p>
                  {message.fileSize && (
                    <span className="text-[10px] text-slate-500">
                      {Math.round(message.fileSize / 1024)} KB
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Text Message Content with WhatsApp formatting */}
            {message.content && (
              <div
                className="text-sm leading-relaxed whitespace-pre-wrap break-words pr-2"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized via formatWhatsAppText
                dangerouslySetInnerHTML={{
                  __html: formatWhatsAppText(message.content, {
                    mentions:
                      message.mentions ||
                      ((message.contentAttributes as Record<string, unknown> | undefined)
                        ?.mentions as MessageMention[] | undefined),
                    isMentioningMe,
                  }),
                }}
              />
            )}
          </>
        )}

        {/* Bottom Metadata: Timestamp + Outgoing Delivery Tick */}
        <div className="flex items-center justify-end gap-1 mt-0.5 ml-3 float-right select-none">
          {message.isEdited && (
            <span
              data-testid="message-edited-badge"
              className="text-[10px] italic text-wa-text-secondary cursor-pointer hover:underline"
              title={
                message.editHistory && message.editHistory.length > 0
                  ? `Diedit (${message.editHistory.length}x)`
                  : 'Diedit'
              }
            >
              (diedit)
            </span>
          )}
          <span className="text-[11px] text-wa-text-secondary leading-none">
            {message.timestamp}
          </span>
          {isOutgoing && <DeliveryStatusTick status={message.status} />}
          {message.status === 'failed' && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="text-[10px] text-rose-600 hover:underline font-semibold ml-1 cursor-pointer"
            >
              Coba lagi
            </button>
          )}
        </div>

        {/* Audit trail popover / view for edited message */}
        {message.isEdited && message.editHistory && message.editHistory.length > 0 && (
          <div
            data-testid="edit-history-popover"
            className="clear-both mt-1.5 pt-1.5 border-t border-black/5 text-[11px] text-wa-text-secondary flex flex-col gap-0.5 select-text"
          >
            <span className="font-semibold text-[10px] uppercase tracking-wider text-slate-500">
              Riwayat Edit:
            </span>
            {message.editHistory.map((item, idx) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: immutable history order
                key={idx}
                className="flex flex-col border-b last:border-0 border-black/5 pb-0.5"
              >
                <span className="text-[9px] text-slate-400">
                  {item.editedAt
                    ? new Date(item.editedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
                <span className="line-through opacity-75">{item.previousContent}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {onReply && (
        <button
          type="button"
          data-testid="btn-reply-message"
          onClick={() => onReply(message)}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 cursor-pointer transition-opacity shrink-0"
          title="Balas pesan ini"
        >
          ↩️ <span className="text-[10px] font-medium hidden sm:inline">Balas</span>
        </button>
      )}
      {onForward && (
        <button
          type="button"
          data-testid="btn-forward-message"
          onClick={() => onForward(message)}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200/50 cursor-pointer transition-opacity shrink-0"
          title="Teruskan pesan ini"
        >
          ↪️ <span className="text-[10px] font-medium hidden sm:inline">Teruskan</span>
        </button>
      )}
    </div>
  )
}

// ==========================================
// ChatTimeline (Full Scrollable Timeline)
// ==========================================
export interface ChatTimelineProps {
  messages: TimelineMessage[]
  onRetryMessage?: (message: TimelineMessage) => void
  onReplyToMessage?: (message: TimelineMessage) => void
  onForwardMessage?: (message: TimelineMessage) => void
  onSaveInternalNote?: (note: string) => void | Promise<void>
  className?: string
}

export function ChatTimeline({
  messages,
  onRetryMessage,
  onReplyToMessage,
  onForwardMessage,
  onSaveInternalNote,
  className = '',
}: ChatTimelineProps) {
  let lastDateGroup = ''
  let lastTicketId = ''
  const seenOpenedTickets = new Set<string>()

  // Pre-scan messages that already contain a ticket_opened activity message
  for (const msg of messages) {
    if (msg.ticketId && msg.messageType === 'activity') {
      // biome-ignore lint/suspicious/noExplicitAny: contentAttributes resolution
      const attrs = (msg.contentAttributes as any) || {}
      if (
        attrs.eventType === 'ticket_opened' ||
        (msg.content?.toLowerCase().includes('tiket #') &&
          msg.content?.toLowerCase().includes('dibuka'))
      ) {
        seenOpenedTickets.add(msg.ticketId)
      }
    }
  }

  return (
    <div data-testid="chat-timeline" className={`flex flex-col py-2 w-full ${className}`}>
      {messages.map((msg) => {
        const showDateSeparator = msg.dateGroup && msg.dateGroup !== lastDateGroup
        if (msg.dateGroup) {
          lastDateGroup = msg.dateGroup
        }

        const isNewTicketBoundary = Boolean(
          msg.ticketId &&
            (!lastTicketId || msg.ticketId !== lastTicketId) &&
            msg.messageType !== 'activity',
        )

        const showTicketSeparator =
          isNewTicketBoundary && Boolean(msg.ticketId && !seenOpenedTickets.has(msg.ticketId))

        if (msg.ticketId) {
          lastTicketId = msg.ticketId
          if (showTicketSeparator) {
            seenOpenedTickets.add(msg.ticketId)
          }
        }

        return (
          <Fragment key={msg.id}>
            {showDateSeparator && msg.dateGroup && <DateSeparatorPill dateText={msg.dateGroup} />}
            {showTicketSeparator && (
              <TicketSeparatorPill
                ticketNumber={msg.ticketDisplayId}
                timestamp={msg.timestamp}
                dateText={msg.dateGroup}
                internalNote={
                  msg.ticketInternalNote ||
                  ((msg.contentAttributes as Record<string, unknown> | undefined)?.internalNote as
                    | string
                    | undefined)
                }
                onSaveInternalNote={onSaveInternalNote}
              />
            )}
            <ChatBubble
              message={msg}
              onRetry={onRetryMessage}
              onReply={onReplyToMessage}
              onForward={onForwardMessage}
            />
          </Fragment>
        )
      })}
    </div>
  )
}

export default ChatTimeline
