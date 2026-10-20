import { Fragment } from 'react'
import type { DeliveryStatus, TimelineMessage } from './types'

// ==========================================
// WhatsApp Text Formatter (*bold*, _italic_, ~strike~, ```code```)
// ==========================================
export function formatWhatsAppText(text: string): string {
  if (!text) return ''

  // Step 1: Escape HTML to avoid XSS
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

  // Step 2: Format monospace ```code```
  escaped = escaped.replace(
    /```([^`]+)```/g,
    '<code class="bg-black/10 px-1 py-0.5 rounded font-mono text-xs">$1</code>',
  )

  // Step 3: Format bold *text*
  escaped = escaped.replace(
    /(^|[^\w])\*([^\s*][^*]*?[^\s*]|[^\s*])\*(?=[^\w]|$)/g,
    '$1<strong>$2</strong>',
  )

  // Step 4: Format italic _text_
  escaped = escaped.replace(/(^|[^\w])_([^\s_][^_]*?[^\s_]|[^\s_])_(?=[^\w]|$)/g, '$1<em>$2</em>')

  // Step 5: Format strikethrough ~text~
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
  ticketNumber?: string
  text?: string
}

export function TicketSeparatorPill({ ticketNumber, text }: TicketSeparatorPillProps) {
  return (
    <div
      data-testid="ticket-separator-pill"
      className="flex items-center justify-center my-4 select-none px-4"
    >
      <div className="flex-1 border-t border-slate-300/80 max-w-xs" />
      <span className="mx-3 px-3 py-1 bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-full border border-emerald-300 shadow-2xs flex items-center gap-1.5">
        <span>🎫</span>
        <span>{text || (ticketNumber ? `Tiket #${ticketNumber} Dimulai` : 'Batas Tiket')}</span>
      </span>
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
}

export function ChatBubble({ message, onRetry }: ChatBubbleProps) {
  // Activity Pill (Status transisi tiket, assignment, dll)
  if (message.messageType === 'activity') {
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

  return (
    <div
      data-testid={isIncoming ? 'chat-bubble-incoming' : 'chat-bubble-outgoing'}
      className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} my-1 px-3 select-text group`}
    >
      <div
        data-tail={isIncoming ? 'incoming' : 'outgoing'}
        className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl px-3.5 pt-2 pb-1.5 shadow-2xs ${
          isIncoming
            ? 'bg-wa-bubble-in text-wa-text-primary rounded-tl-xs border border-black/5'
            : 'bg-wa-bubble-out text-wa-text-primary rounded-tr-xs border border-emerald-900/5'
        }`}
      >
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
        {isIncoming && message.senderName && (
          <div className="text-[11px] font-bold text-emerald-800 mb-0.5 leading-tight">
            {message.senderName}
          </div>
        )}

        {/* Media Attachments Preview */}
        {message.contentType === 'image' && message.mediaUrl && (
          <div className="mb-1.5 rounded-lg overflow-hidden bg-slate-100 max-h-64 border border-black/5">
            <img
              data-testid="bubble-media-image"
              src={message.mediaUrl}
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
              __html: formatWhatsAppText(message.content),
            }}
          />
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
    </div>
  )
}

// ==========================================
// ChatTimeline (Full Scrollable Timeline)
// ==========================================
export interface ChatTimelineProps {
  messages: TimelineMessage[]
  onRetryMessage?: (message: TimelineMessage) => void
  className?: string
}

export function ChatTimeline({ messages, onRetryMessage, className = '' }: ChatTimelineProps) {
  let lastDateGroup = ''
  let lastTicketId = ''

  return (
    <div data-testid="chat-timeline" className={`flex flex-col py-2 w-full ${className}`}>
      {messages.map((msg) => {
        const showDateSeparator = msg.dateGroup && msg.dateGroup !== lastDateGroup
        if (msg.dateGroup) {
          lastDateGroup = msg.dateGroup
        }

        const showTicketSeparator = Boolean(
          msg.ticketId &&
            lastTicketId &&
            msg.ticketId !== lastTicketId &&
            msg.messageType !== 'activity',
        )
        if (msg.ticketId) {
          lastTicketId = msg.ticketId
        }

        return (
          <Fragment key={msg.id}>
            {showDateSeparator && msg.dateGroup && <DateSeparatorPill dateText={msg.dateGroup} />}
            {showTicketSeparator && (
              <TicketSeparatorPill
                ticketNumber={msg.ticketDisplayId}
                text={msg.ticketDisplayId ? `Tiket #${msg.ticketDisplayId} Dimulai` : undefined}
              />
            )}
            <ChatBubble message={msg} onRetry={onRetryMessage} />
          </Fragment>
        )
      })}
    </div>
  )
}

export default ChatTimeline
