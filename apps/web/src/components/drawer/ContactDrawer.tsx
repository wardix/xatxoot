import { useState } from 'react'
import { Avatar, Badge, Button } from '../astryx'
import type { ActiveTicketData, ContactDrawerData, TicketHistoryItem } from './types'

// ==========================================
// 1. ContactProfileSection
// ==========================================
export interface ContactProfileSectionProps {
  contact: ContactDrawerData
}

export function ContactProfileSection({ contact }: ContactProfileSectionProps) {
  return (
    <div
      data-testid="drawer-contact-profile"
      className="flex flex-col items-center text-center pb-5 border-b border-[#e9edef]"
    >
      {/* Contact Avatar */}
      <Avatar
        name={contact.contactName}
        src={contact.avatarUrl}
        channel={contact.channel}
        size="xl"
        className="mb-3"
      />

      {/* Name & Phone */}
      <h3 className="font-bold text-lg text-[#111b21] leading-tight">{contact.contactName}</h3>

      {contact.contactPhone && (
        <p className="text-sm text-[#667781] mt-0.5">{contact.contactPhone}</p>
      )}

      {contact.contactEmail && (
        <p className="text-xs text-slate-500 mt-0.5">{contact.contactEmail}</p>
      )}

      {contact.companyName && (
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
          <span>🏢</span>
          <span>{contact.companyName}</span>
        </div>
      )}

      {/* Labels / Tags */}
      {contact.tags && contact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center mt-3 max-w-xs">
          {contact.tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              🏷️ {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Custom Attributes Key-Value */}
      {contact.customAttributes && Object.keys(contact.customAttributes).length > 0 && (
        <div
          data-testid="drawer-custom-attributes"
          className="w-full mt-4 bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-left"
        >
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Atribut Kontak
          </h4>
          <div className="flex flex-col divide-y divide-slate-200/60 text-xs">
            {Object.entries(contact.customAttributes).map(([key, val]) => (
              <div key={key} className="flex justify-between py-1.5">
                <span className="text-slate-500 font-medium">{key}</span>
                <span className="text-slate-800 font-semibold">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// 2. StickyInternalNoteCard (1:1 Sticky Note)
// ==========================================
export interface StickyInternalNoteCardProps {
  ticket?: ActiveTicketData
  onSaveNote?: (noteText: string) => void
}

export function StickyInternalNoteCard({ ticket, onSaveNote }: StickyInternalNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [noteContent, setNoteContent] = useState(ticket?.internalNote || '')

  const handleSave = () => {
    if (onSaveNote) {
      onSaveNote(noteContent)
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setNoteContent(ticket?.internalNote || '')
    setIsEditing(false)
  }

  const handleClear = () => {
    setNoteContent('')
    if (onSaveNote) {
      onSaveNote('')
    }
    setIsEditing(false)
  }

  return (
    <div
      data-testid="sticky-internal-note-card"
      className="bg-[#fef3c7] border border-[#fde68a] rounded-xl p-4 flex flex-col gap-2.5 shadow-2xs"
    >
      {/* Header Kartu */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
          <span>📌</span>
          <span>1:1 Sticky Case Note</span>
        </span>
        {ticket && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 border border-amber-300">
            #{ticket.ticketNumber}
          </span>
        )}
      </div>

      {/* Note Content / Edit Form */}
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            rows={3}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Tulis catatan internal untuk tiket ini..."
            className="w-full text-xs text-amber-950 bg-amber-50 rounded-lg p-2.5 border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between">
            {ticket?.internalNote && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-rose-700 hover:underline cursor-pointer"
              >
                Hapus
              </button>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="text-xs text-amber-900 hover:bg-amber-200/60"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                className="text-xs bg-amber-700 hover:bg-amber-800 text-white"
              >
                Simpan
              </Button>
            </div>
          </div>
        </div>
      ) : ticket?.internalNote ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-amber-950 leading-relaxed whitespace-pre-wrap">
            {ticket.internalNote}
          </p>

          <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 text-[10px] text-amber-800">
            <span>
              {ticket.internalNoteUpdatedBy && `Oleh ${ticket.internalNoteUpdatedBy}`}
              {ticket.internalNoteUpdatedAt && ` (${ticket.internalNoteUpdatedAt})`}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="font-semibold underline hover:text-amber-950 cursor-pointer"
            >
              Ubah
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-2 text-center">
          <p className="text-xs text-amber-800/80 mb-2">
            Belum ada catatan internal untuk kasus ini.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="text-xs bg-amber-200/80 hover:bg-amber-300 text-amber-950 border-amber-300"
          >
            + Tambah Catatan
          </Button>
        </div>
      )}
    </div>
  )
}

// ==========================================
// 3. TicketHistorySection
// ==========================================
export interface TicketHistorySectionProps {
  activeTicketId?: string
  tickets: TicketHistoryItem[]
  onSelectTicket?: (ticketId: string) => void
}

export function TicketHistorySection({
  activeTicketId,
  tickets,
  onSelectTicket,
}: TicketHistorySectionProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'ticket-open'
      case 'pending':
        return 'ticket-pending'
      case 'resolved':
        return 'ticket-resolved'
      case 'snoozed':
        return 'ticket-snoozed'
      default:
        return 'default'
    }
  }

  return (
    <div data-testid="drawer-ticket-history" className="flex flex-col gap-2.5 pt-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Riwayat Tiket</h4>
        <span className="text-[11px] text-slate-500 font-medium">{tickets.length} Tiket</span>
      </div>

      {tickets.length === 0 ? (
        <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60">
          Belum ada riwayat tiket terdahulu untuk kontak ini.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => {
            const isActive = activeTicketId === t.id
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => onSelectTicket?.(t.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-800">#{t.ticketNumber}</span>
                  <Badge variant={getStatusBadgeVariant(t.status)} size="sm">
                    {t.status}
                  </Badge>
                </div>

                {t.title && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-snug mb-1.5">
                    {t.title}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{t.createdAt}</span>
                  {t.assignedTo && <span>Ditugaskan: {t.assignedTo}</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==========================================
// 4. ContactDrawer Full Component
// ==========================================
export interface ContactDrawerProps {
  isOpen: boolean
  data: ContactDrawerData | null
  onClose: () => void
  onSaveNote?: (note: string) => void
  onSelectTicket?: (ticketId: string) => void
}

export function ContactDrawer({
  isOpen,
  data,
  onClose,
  onSaveNote,
  onSelectTicket,
}: ContactDrawerProps) {
  if (!isOpen || !data) {
    return null
  }

  return (
    <aside
      data-testid="contact-crm-drawer"
      className="w-[360px] md:w-[380px] h-full bg-white border-l border-[#e9edef] flex flex-col shrink-0 select-none overflow-hidden z-20 shadow-xl"
    >
      {/* Header Drawer */}
      <div className="h-16 bg-[#f0f2f5] px-4 flex items-center justify-between border-b border-[#e9edef] shrink-0">
        <h3 className="font-bold text-base text-[#111b21]">Info Kontak &amp; CRM</h3>
        <button
          type="button"
          data-testid="btn-close-drawer"
          onClick={onClose}
          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-200/60 cursor-pointer"
          title="Tutup Panel"
        >
          ✕
        </button>
      </div>

      {/* Drawer Scroll Body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Section 1: Profil Kontak */}
        <ContactProfileSection contact={data} />

        {/* Section 2: 1:1 Sticky Case Note */}
        <StickyInternalNoteCard ticket={data.activeTicket} onSaveNote={onSaveNote} />

        {/* Section 3: Info Tiket Aktif */}
        {data.activeTicket && (
          <div
            data-testid="drawer-ticket-info"
            className="border border-[#e9edef] rounded-xl p-3.5 flex flex-col gap-2 bg-[#f9fafb]"
          >
            <h5 className="font-semibold text-xs text-slate-700 uppercase tracking-wider">
              Informasi Tiket
            </h5>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Nomor Tiket:</span>
                <span className="font-bold text-emerald-800">
                  #{data.activeTicket.ticketNumber}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Status:</span>
                <span className="font-medium capitalize text-slate-800">
                  {data.activeTicket.status}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Prioritas:</span>
                <span className="font-semibold uppercase text-rose-700">
                  {data.activeTicket.priority || 'medium'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Riwayat Tiket */}
        <TicketHistorySection
          activeTicketId={data.activeTicket?.id}
          tickets={data.ticketHistory || []}
          onSelectTicket={onSelectTicket}
        />
      </div>
    </aside>
  )
}

export default ContactDrawer
