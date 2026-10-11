import { describe, expect, it } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ContactDrawer,
  ContactProfileSection,
  StickyInternalNoteCard,
  TicketHistorySection,
} from './ContactDrawer'
import type { ContactDrawerData, TicketHistoryItem } from './types'

describe('Contact CRM Drawer Component (Task 1.26 - apps/web)', () => {
  const mockTicketHistory: TicketHistoryItem[] = [
    {
      id: 't-101',
      ticketNumber: 'T-101',
      status: 'open',
      priority: 'high',
      title: 'Kendala pengiriman ekspedisi resi JKT-8899',
      createdAt: '11 Okt 2026, 10:40',
      assignedTo: 'Petugas CS',
    },
    {
      id: 't-085',
      ticketNumber: 'T-085',
      status: 'resolved',
      priority: 'medium',
      title: 'Pertanyaan klaim garansi produk elektronik',
      createdAt: '28 Sep 2026, 14:15',
      resolvedAt: '28 Sep 2026, 16:30',
      assignedTo: 'Sarah CS',
    },
  ]

  const mockDrawerData: ContactDrawerData = {
    contactId: 'c-100',
    contactName: 'Budi Santoso',
    contactPhone: '+6281234567890',
    contactEmail: 'budi.santoso@example.com',
    companyName: 'PT Maju Bersama',
    avatarUrl: 'https://example.com/avatar.jpg',
    channel: 'whatsapp',
    tags: ['VIP', 'Ekspedisi', 'Jabodetabek'],
    customAttributes: {
      Kota: 'Jakarta Selatan',
      'Membership Tier': 'Gold Platinum',
      'Total Order': '24 Transaksi',
    },
    activeTicket: {
      id: 't-101',
      ticketNumber: 'T-101',
      status: 'open',
      priority: 'high',
      internalNote:
        'Pelanggan prioritas tinggi. Menghubungi berkali-kali menanyakan resi JKT-8899.',
      internalNoteUpdatedAt: '10 menit lalu',
      internalNoteUpdatedBy: 'Petugas CS',
    },
    ticketHistory: mockTicketHistory,
  }

  describe('ContactProfileSection', () => {
    it('should render contact info, avatar, phone, email, organization, and tags', () => {
      const html = renderToStaticMarkup(<ContactProfileSection contact={mockDrawerData} />)

      expect(html).toContain('data-testid="drawer-contact-profile"')
      expect(html).toContain('Budi Santoso')
      expect(html).toContain('+6281234567890')
      expect(html).toContain('budi.santoso@example.com')
      expect(html).toContain('PT Maju Bersama')

      // Tags & Channel
      expect(html).toContain('VIP')
      expect(html).toContain('Ekspedisi')
      expect(html).toContain('Jabodetabek')
      expect(html).toContain('whatsapp')
    })

    it('should render custom attributes key-value table', () => {
      const html = renderToStaticMarkup(<ContactProfileSection contact={mockDrawerData} />)

      expect(html).toContain('data-testid="drawer-custom-attributes"')
      expect(html).toContain('Jakarta Selatan')
      expect(html).toContain('Gold Platinum')
      expect(html).toContain('24 Transaksi')
    })
  })

  describe('StickyInternalNoteCard (1:1 Sticky Note)', () => {
    it('should render 1:1 sticky internal note card with #fef3c7 background and metadata', () => {
      const html = renderToStaticMarkup(
        <StickyInternalNoteCard ticket={mockDrawerData.activeTicket} onSaveNote={() => {}} />,
      )

      expect(html).toContain('data-testid="sticky-internal-note-card"')
      expect(html).toContain('bg-[#fef3c7]')
      expect(html).toContain('1:1 Sticky Case Note')
      expect(html).toContain('#T-101')
      expect(html).toContain('Pelanggan prioritas tinggi')
      expect(html).toContain('Petugas CS')
      expect(html).toContain('10 menit lalu')
    })

    it('should render empty prompt when active ticket has no internal note', () => {
      const ticketWithoutNote = {
        ...mockDrawerData.activeTicket,
        internalNote: undefined,
      }

      const html = renderToStaticMarkup(
        <StickyInternalNoteCard ticket={ticketWithoutNote} onSaveNote={() => {}} />,
      )

      expect(html).toContain('data-testid="sticky-internal-note-card"')
      expect(html).toContain('Belum ada catatan internal')
    })
  })

  describe('TicketHistorySection', () => {
    it('should render ticket history items with status badges and timestamps', () => {
      const html = renderToStaticMarkup(
        <TicketHistorySection activeTicketId="t-101" tickets={mockTicketHistory} />,
      )

      expect(html).toContain('data-testid="drawer-ticket-history"')
      expect(html).toContain('Riwayat Tiket')
      expect(html).toContain('#T-101')
      expect(html).toContain('#T-085')
      expect(html).toContain('Kendala pengiriman ekspedisi')
      expect(html).toContain('Pertanyaan klaim garansi')

      // Status badges
      expect(html).toContain('open')
      expect(html).toContain('resolved')
    })

    it('should display empty message when ticket history is empty', () => {
      const html = renderToStaticMarkup(
        <TicketHistorySection activeTicketId="t-101" tickets={[]} />,
      )

      expect(html).toContain('Belum ada riwayat tiket terdahulu')
    })
  })

  describe('ContactDrawer Full Component', () => {
    it('should render all sections (profile, sticky note, history) when open', () => {
      const html = renderToStaticMarkup(
        <ContactDrawer
          isOpen={true}
          data={mockDrawerData}
          onClose={() => {}}
          onSaveNote={() => {}}
        />,
      )

      expect(html).toContain('data-testid="contact-crm-drawer"')
      expect(html).toContain('w-[360px]')
      expect(html).toContain('Info Kontak &amp; CRM')
      expect(html).toContain('data-testid="btn-close-drawer"')
      expect(html).toContain('data-testid="drawer-contact-profile"')
      expect(html).toContain('data-testid="sticky-internal-note-card"')
      expect(html).toContain('data-testid="drawer-ticket-history"')
    })

    it('should not render visible content when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <ContactDrawer
          isOpen={false}
          data={mockDrawerData}
          onClose={() => {}}
          onSaveNote={() => {}}
        />,
      )

      expect(html).not.toContain('data-testid="contact-crm-drawer"')
    })
  })
})
