import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Conversations, Tickets, and Messages Database Migration (apps/api/migrations/002_phase1_inbox.sql)', () => {
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

  it('should define conversations, tickets, messages, attachments, and labels tables conforming to DATABASE_SCHEMA.md & PHASE_1_CHECKLIST.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?conversations/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?tickets/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?messages/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?attachments/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?labels/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?ticket_labels/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?contact_labels/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns and foreign keys for conversations', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('contact_id')
    expect(sql).toContain('inbox_id')
    expect(sql).toContain('last_message_at')
    expect(sql).toContain('unread_count')
    expect(sql).toContain('REFERENCES inboxes(id)')
    expect(sql).toContain('REFERENCES contacts(id)')
  })

  it('should include required columns and 1:1 internal_note for tickets', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('conversation_id')
    expect(sql).toContain('status')
    expect(sql).toContain('priority')
    expect(sql).toContain('assignee_id')
    expect(sql).toContain('internal_note')
    expect(sql).toContain('snoozed_until')
    expect(sql).toContain('REFERENCES conversations(id)')
  })

  it('should include required columns for messages', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('conversation_id')
    expect(sql).toContain('ticket_id')
    expect(sql).toContain('sender_type')
    expect(sql).toContain('message_type')
    expect(sql).toContain('content')
    expect(sql).toContain('status')
    expect(sql).toContain('external_source_id')
  })

  it('should include required columns for attachments', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('message_id')
    expect(sql).toContain('file_type')
    expect(sql).toContain('file_url')
    expect(sql).toContain('file_size')
    expect(sql).toContain('REFERENCES messages(id)')
  })

  it('should include label relationship tables with unique constraints', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    expect(sql).toContain('REFERENCES labels(id)')
    expect(sql).toMatch(/UNIQUE\s*\(\s*ticket_id\s*,\s*label_id\s*\)/i)
    expect(sql).toMatch(/UNIQUE\s*\(\s*contact_id\s*,\s*label_id\s*\)/i)
  })
})
