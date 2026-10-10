import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Contacts and ContactInboxes Database Migration (apps/api/migrations/002_phase1_inbox.sql)', () => {
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

  it('should define contacts and contact_inboxes tables conforming to DATABASE_SCHEMA.md & PHASE_1_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?contacts/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?contact_inboxes/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and types for contacts', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('name VARCHAR')
    expect(sql).toContain('phone_number')
    expect(sql).toContain('email')
    expect(sql).toContain('avatar_url')
    expect(sql).toContain('custom_attributes')
  })

  it('should include required columns, foreign keys, and unique constraint for contact_inboxes', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('contact_id')
    expect(sql).toContain('inbox_id')
    expect(sql).toContain('source_id')
    expect(sql).toContain('REFERENCES contacts(id)')
    expect(sql).toContain('REFERENCES inboxes(id)')
    expect(sql).toMatch(/UNIQUE\s*\(\s*inbox_id\s*,\s*source_id\s*\)/i)
  })
})
