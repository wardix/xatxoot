# Checklist Teknis Fase 1: MVP Inbox + WhatsApp — Xatxoot

> **Phase 1 Implementation Roadmap & Task Breakdown**  
> Rencana kerja teknis atomik untuk membangun MVP Inbox WhatsApp-First (Cloud API resmi & Baileys unofficial), manajemen Kontak, Percakapan, Tiket, 1:1 Sticky Internal Note, dan Live Chat Widget.

---

## 🎯 Target Utama Fase 1
1. **Dukungan Dual-Provider WhatsApp**:
   - Meta Cloud API Graph v18.0+ (dengan verifikasi webhook `X-Hub-Signature-256`).
   - WhatsApp Unofficial Gateway (`apps/wa-gateway` via Baileys Multi-Device & pairing QR).
   - WhatsApp Cloud API Simulator (`apps/wa-simulator`) untuk dev & testing offline.
2. **Pemisahan Domain `Conversation` vs `Ticket`**:
   - `Conversation` sebagai wadah ruang obrolan terus-menerus per kontak.
   - `Ticket` sebagai unit kerja operasional (`open`, `pending`, `snoozed`, `resolved`).
   - **1:1 Sticky Case Note** di drawer tiket (bukan chat bubble).
3. **Frontend Dashboard WhatsApp Web (3.5 Kolom)**:
   - Kolom 0.5: Navigasi modul & indikator status agent.
   - Kolom 1: Daftar percakapan/tiket dengan tab filter (*Mine*, *Unassigned*, *All*).
   - Kolom 2: Ruang obrolan dengan bubble khas WhatsApp, double tick, status bar.
   - Kolom 3: Drawer detail kontak & kartu tersemat *Sticky Internal Note*.
4. **Website Live Chat Widget** (`packages/widget`, < 80 KB gzipped).
5. **Realtime Server-Sent Events (SSE)** untuk sinkronisasi seketika (< 1 detik).

---

## 📋 Daftar Tugas Atomik (Step-by-Step)

### Bagian 1: Skema Database & Migrasi (`apps/api/migrations/002_phase1_inbox.sql`)
- [x] **Task 1.1**: Buat skema migrasi tabel channels:
  - `channels_whatsapp_cloud` (phone_number_id, waba_id, access_token, webhook_verify_token).
  - `channels_whatsapp_unofficial` (phone_number, session_id, connection_status).
  - `channels_web_widget` (website_token, allowed_domains, widget_color).
  - `channels_api` (api_key_hash, webhook_url).
  - `inboxes` & `inbox_members`.
- [x] **Task 1.2**: Buat skema tabel kontak & relasi:
  - `contacts` (name, phone_number, email, avatar_url, custom_attributes).
  - `contact_inboxes` (contact_id, inbox_id, source_id unik).
- [ ] **Task 1.3**: Buat skema tabel percakapan, tiket, dan pesan:
  - `conversations` (contact_id, inbox_id, last_message_at, unread_count).
  - `tickets` (conversation_id, status: `open`|`pending`|`snoozed`|`resolved`, priority, assignee_id, `internal_note`, snoozed_until).
  - `messages` (conversation_id, ticket_id, sender_type, message_type, content, status, external_source_id).
  - `attachments` (message_id, file_type, file_url, file_size).
  - `labels`, `ticket_labels`, `contact_labels`.
- [ ] **Task 1.4**: Uji eksekusi migrasi `bun run db:migrate` dan pastikan idempotent.

---

### Bagian 2: Shared Types & Validasi Zod (`packages/shared`)
- [ ] **Task 1.5**: Tipe & skema validasi Zod untuk Inbox & Channel configuration.
- [ ] **Task 1.6**: Tipe & skema validasi Zod untuk Contact & ContactInbox.
- [ ] **Task 1.7**: Tipe & skema validasi Zod untuk Message payload & Ticket lifecycle transitions.

---

### Bagian 3: WhatsApp Simulator (`apps/wa-simulator`)
- [ ] **Task 1.8 (TDD)**: Test suite untuk verifikasi webhook challenge (`hub.mode`, `hub.challenge`, `hub.verify_token`).
- [ ] **Task 1.9**: Implementasi mock endpoint Graph API v18.0+ (`POST /v18.0/{phone_number_id}/messages`).
- [ ] **Task 1.10**: Webhook generator UI/API untuk menembakkan simulasi pesan masuk pelanggan ke `apps/api`.

---

### Bagian 4: WhatsApp Unofficial Gateway (`apps/wa-gateway`)
- [ ] **Task 1.11**: Setup koneksi Baileys Multi-Device di runtime Node.js LTS v20.
- [ ] **Task 1.12**: Penanganan event pairing QR code $\rightarrow$ publish ke Redis `wa:session:qr`.
- [ ] **Task 1.13**: Penanganan event pesan masuk $\rightarrow$ publish ke Redis `wa:inbound:message`.
- [ ] **Task 1.14**: Setup BullMQ worker untuk antrean `wa-outbound` (eksekusi pengiriman pesan outbound melalui socket Baileys).

---

### Bagian 5: Modul Backend API (`apps/api`) — Siklus TDD RED-GREEN-REFACTOR
- [ ] **Task 1.15 (RED)**: Tulis test `inboxes.test.ts` (CRUD Inbox, pairing channel WhatsApp Cloud & Baileys).
- [ ] **Task 1.16 (GREEN)**: Implementasi controller & service `inboxes`.
- [ ] **Task 1.17 (RED)**: Tulis test `whatsapp-cloud.webhook.test.ts` (verifikasi signature `X-Hub-Signature-256`, penerimaan pesan teks & media).
- [ ] **Task 1.18 (GREEN)**: Implementasi webhook receiver Meta Cloud API.
- [ ] **Task 1.19 (RED)**: Tulis test `conversations.test.ts` & `tickets.test.ts`:
  - Pesan masuk otomatis mencari/membuat Contact & Conversation.
  - Pembuatan Ticket baru otomatis jika belum ada tiket open.
  - Transisi status tiket (`open` $\rightarrow$ `pending` $\rightarrow$ `resolved` $\rightarrow$ `snoozed`).
  - Pembaruan 1:1 Sticky Note (`PATCH /api/v1/tickets/:id/note`).
- [ ] **Task 1.20 (GREEN)**: Implementasi service Conversation, Ticket, dan Sticky Note.
- [ ] **Task 1.21 (RED)**: Tulis test `messages.test.ts` (pengiriman balasan agent via WhatsApp Cloud & antrean Baileys).
- [ ] **Task 1.22 (GREEN)**: Implementasi pengiriman pesan outbound.
- [ ] **Task 1.23**: Implementasi SSE stream endpoint `GET /api/v1/realtime/stream`.

---

### Bagian 6: Antarmuka Web Dashboard (`apps/web`)
- [ ] **Task 1.24**: Implementasi layout 3.5 kolom khas WhatsApp Web menggunakan token tema & komponen Astryx.
- [ ] **Task 1.25**: Komponen Chat Timeline: bubble bertail, penanda pesan masuk vs keluar, double check delivery status.
- [ ] **Task 1.26**: Panel Samping Kanan (Drawer): profil kontak, riwayat tiket, dan kartu edit *1:1 Sticky Internal Note*.
- [ ] **Task 1.27**: Dialog pairing WhatsApp Baileys via live QR code generator.
- [ ] **Task 1.28**: Integrasi custom hook SSE untuk real-time update tanpa refresh halaman.

---

### Bagian 7: Website Live Chat Widget (`packages/widget`)
- [ ] **Task 1.29**: Scaffold widget bundle mandiri (< 80 KB gzipped) berbasis Preact/React.
- [ ] **Task 1.30**: API endpoint publik untuk komunikasi widget (`POST /api/v1/widget/messages`, SSE untuk balasan agent).
- [ ] **Task 1.31**: Fitur kustomisasi warna & judul widget sesuai pengaturan Inbox.

---

### Bagian 8: Verifikasi & Quality Gate
- [ ] **Task 1.32**: Jalankan seluruh unit & integration test (`bun test`) — pastikan 100% PASS.
- [ ] **Task 1.33**: Jalankan `bun run check` (Biome) — pastikan 0 error dan 0 warning.
