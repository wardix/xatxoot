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
          className={`inline-flex items-center text-[11px] text-[#53bdeb] font-bold tracking-[-3px] mr-1 select-none ${className}`}
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
          className="px-3 py-1 bg-slate-200/80 backdrop-blur-xs text-[11px] font-medium text-slate-700 rounded-lg shadow-2xs text-center border border-slate-300/60 max-w-md"
        >
          {message.content}
        </span>
      </div>
    )
  }

  const isIncoming = message.messageType === 'incoming'
  const isOutgoing = message.messageType === 'outgoing'

  return (
    <div
      data-testid={isIncoming ? 'chat-bubble-incoming' : 'chat-bubble-outgoing'}
      className={`flex ${isIncoming ? 'justify-start' : 'justify-end'} my-1 px-3 select-text group`}
    >
      <div
        data-tail={isIncoming ? 'incoming' : 'outgoing'}
        className={`relative max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-2xl px-3.5 pt-2 pb-1.5 shadow-2xs ${
          isIncoming
            ? 'bg-[#ffffff] text-[#111b21] rounded-tl-xs border border-black/5'
            : 'bg-[#d9fdd3] text-[#111b21] rounded-tr-xs border border-emerald-900/5'
        }`}
      >
        {/* WhatsApp-style Tail SVG */}
        {isIncoming ? (
          <svg
            className="absolute top-0 -left-2 w-2.5 h-3 text-[#ffffff]"
            viewBox="0 0 8 13"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M1.533 3.568L8 12.186V0H2.812C1.042 0 .149 2.132 1.533 3.568z" />
          </svg>
        ) : (
          <svg
            className="absolute top-0 -right-2 w-2.5 h-3 text-[#d9fdd3]"
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
              <p className="text-xs font-semibold truncate text-[#111b21]">
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
          <span className="text-[11px] text-[#667781] leading-none">{message.timestamp}</span>
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

  return (
    <div data-testid="chat-timeline" className={`flex flex-col py-2 w-full ${className}`}>
      {messages.map((msg) => {
        const showDateSeparator = msg.dateGroup && msg.dateGroup !== lastDateGroup
        if (msg.dateGroup) {
          lastDateGroup = msg.dateGroup
        }

        return (
          <Fragment key={msg.id}>
            {showDateSeparator && msg.dateGroup && <DateSeparatorPill dateText={msg.dateGroup} />}
            <ChatBubble message={msg} onRetry={onRetryMessage} />
          </Fragment>
        )
      })}
    </div>
  )
}

export default ChatTimeline
