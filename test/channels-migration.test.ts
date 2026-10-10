import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Channels and Inbox Database Migration (apps/api/migrations/002_phase1_inbox.sql)', () => {
  const migrationPath = join(
    import.meta.dir,
    '..',
    'apps',
    'api',
    'migrations',
    '002_phase1_inbox.sql',
  )

  it('should exist at apps/api/migrations/002_phase1_inbox.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define channels and inboxes tables conforming to DATABASE_SCHEMA.md & PHASE_1_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    // Channel & Inbox tables
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_whatsapp_cloud/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_whatsapp_unofficial/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_web_widget/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?channels_api/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?inboxes/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?inbox_members/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and constraints for channels_whatsapp_cloud', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('phone_number_id')
    expect(sql).toContain('waba_id')
    expect(sql).toContain('access_token')
    expect(sql).toContain('webhook_verify_token')
  })

  it('should include required columns for channels_whatsapp_unofficial', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('phone_number')
    expect(sql).toContain('session_id')
    expect(sql).toContain('connection_status')
  })

  it('should include required columns for channels_web_widget', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('website_token')
    expect(sql).toContain('allowed_domains')
    expect(sql).toContain('widget_color')
  })

  it('should include required columns for channels_api', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('api_key_hash')
    expect(sql).toContain('webhook_url')
  })

  it('should include required columns and constraints for inboxes and inbox_members', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    // inboxes columns
    expect(sql).toContain('channel_type')
    expect(sql).toContain('channel_id')
    expect(sql).toContain('enable_auto_assign')

    // inbox_members relations
    expect(sql).toContain('REFERENCES inboxes(id)')
    expect(sql).toContain('REFERENCES users(id)')
    expect(sql).toMatch(/UNIQUE\s*\(\s*inbox_id\s*,\s*user_id\s*\)/i)
  })
})
