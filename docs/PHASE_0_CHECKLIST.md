# Checklist Teknis Fase 0: Fondasi & Autentikasi — Xatxoot

> **Phase 0 Implementation Roadmap & Task Breakdown**  
> Rencana kerja teknis atomik untuk membangun fondasi monorepo, database, autentikasi, dan konfigurasi tooling sebelum memasuki Fase 1 (MVP WhatsApp Inbox).

---

## 🎯 Target Utama Fase 0
1. Monorepo Bun Workspaces siap pakai dengan linter Biome.
2. Lingkungan kontainer lokal (PostgreSQL 16 & Redis 7) via `docker compose`.
3. Runner migrasi mandiri berbasis Raw Bun SQL (`apps/api/migrations/001_init.sql`).
4. Package `packages/shared` untuk tipe TypeScript dan validasi Zod bersama.
5. Modul Autentikasi `apps/api` (TDD RED-GREEN-REFACTOR):
   - Setup Administrator pertama & Organisasi singleton.
   - Login dengan Argon2id (`Bun.password.hash`) & JWT/Session token.
   - Google OAuth SSO dengan filter `GOOGLE_ALLOWED_DOMAINS`.
   - Middleware otorisasi (`authGuard`).
6. Antarmuka `apps/web` (React 19 + Vite + Tailwind + Biome) untuk layar Setup Instance & Login.
7. Pemeriksaan 100% lulus untuk `bun test` dan `bun run check`.

---

## 📋 Daftar Tugas Atomik (Step-by-Step)

### Bagian 1: Inisialisasi Monorepo & Tooling
- [x] **Task 0.1**: Buat root `package.json` dengan konfigurasi Bun Workspaces (`apps/*`, `packages/*`) dan skrip global (`dev`, `build`, `test`, `check`, `lint`).
- [x] **Task 0.2**: Buat `biome.json` di root dengan aturan ketat sesuai `AGENTS.md`:
  - `quoteStyle`: `'single'`
  - `jsxQuoteStyle`: `"double"`
  - `semicolons`: `"asNeeded"`
  - `indentStyle`: `"space"`, `indentWidth`: `2`
  - `lineWidth`: `100`
- [x] **Task 0.3**: Buat `tsconfig.base.json` untuk shared compiler options TypeScript (ESNext, Bun/DOM types, strict mode).
- [x] **Task 0.4**: Siapkan `docker-compose.dev.yml` yang menjalankan PostgreSQL 16 (port 5432) dan Redis 7 (port 6379) dengan volume persisten.
- [x] **Task 0.5**: Buat file `.env.example` master yang mendokumentasikan seluruh variabel lingkungan (DB, Redis, JWT secret, Google SSO).

---

### Bagian 2: Paket Bersama (`packages/shared`)
- [x] **Task 0.6**: Inisialisasi `packages/shared/package.json` dan `tsconfig.json`.
- [x] **Task 0.7**: Buat skema validasi Zod & tipe data TypeScript:
  - Skema setup organisasi (`OrganizationSetupInput`).
  - Skema login kredensial (`LoginInput`).
  - Skema user & role (`User`, `Role`, `UserRole`).
  - Skema token autentikasi (`AuthTokens`, `AuthSession`).

---

### Bagian 3: Database & Migration Runner (`apps/api`)
- [x] **Task 0.8**: Inisialisasi `apps/api/package.json` dengan dependensi (`hono`, `@hono/node-server`, `zod`, dll.) dan skrip test runner.
- [x] **Task 0.9**: Buat modul koneksi database `apps/api/src/db/index.ts` menggunakan native Bun SQL (`import { SQL } from "bun"`).
- [x] **Task 0.10**: Buat runner migrasi mandiri `apps/api/src/db/migrate.ts` yang membaca file `.sql` di folder `migrations/` dan mencatatnya ke tabel `schema_migrations`.
- [x] **Task 0.11**: Buat file migrasi `apps/api/migrations/001_init.sql` yang mencakup tabel fondasi:
  - `organizations` (singleton profil instansi).
  - `users` (pengguna/staf).
  - `roles` & `permissions` & `user_roles`.
  - `sessions` / `refresh_tokens`.
  - `audit_logs`.

---

### Bagian 4: Modul Autentikasi Backend (Protokol TDD RED-GREEN)
- [x] **Task 0.12 (RED)**: Tulis file unit & integration test `apps/api/src/modules/auth/auth.test.ts`:
  - Pengujian hashing password Argon2id.
  - Pengujian `POST /api/v1/auth/setup` (membuat singleton organization & admin pertama, menolak jika sudah di-setup).
  - Pengujian `POST /api/v1/auth/login` (kredensial valid menghasilkan token, kredensial salah menghasilkan 401).
  - Pengujian `POST /api/v1/auth/refresh` & `POST /api/v1/auth/logout`.
  - Pengujian domain restriction pada Google OAuth callback.
  - *Jalankan `bun test` dan verifikasi seluruh test berstatus GAGAL (RED).*
- [x] **Task 0.13 (GREEN)**: Implementasikan kode service & controller di `apps/api/src/modules/auth/`:
  - `auth.service.ts`: Logika hashing `Bun.password`, pengecekan DB, pembuatan JWT/token.
  - `auth.controller.ts`: Routing Hono dengan validasi Zod validator.
  - `auth.middleware.ts`: Verifikasi bearer token & inject konteks user saat ini (`c.set('user', user)`).
  - *Jalankan `bun test` dan verifikasi 100% PASS (GREEN).*
- [x] **Task 0.14 (REFACTOR)**: Rapikan kode, pastikan parameter binding raw SQL aman, dan jalankan `bun run check` (Biome).

---

### Bagian 5: Antarmuka Web Awal (`apps/web`)
- [x] **Task 0.15**: Scaffold proyek Vite React 19 di `apps/web/` dengan Tailwind CSS dan Biome.
- [x] **Task 0.16**: Buat halaman `SetupPage` (untuk inisialisasi instalasi pertama kali jika organisasi belum ada).
- [x] **Task 0.17**: Buat halaman `LoginPage` dengan form login email/password serta tombol Google SSO.
- [x] **Task 0.18**: Buat layout shell dasar (top bar & status sesi).

---

### Bagian 6: Verifikasi & Quality Gate
- [x] **Task 0.19**: Jalankan `bun test` di seluruh monorepo — pastikan 100% lulus tanpa kegagalan.
- [x] **Task 0.20**: Jalankan `bun run check` — pastikan linter dan formatter Biome bersih tanpa warning atau error.
