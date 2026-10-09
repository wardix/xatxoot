import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Initial Database Migration (apps/api/migrations/001_init.sql)', () => {
  const migrationPath = join(import.meta.dir, '..', 'apps', 'api', 'migrations', '001_init.sql')

  it('should exist at apps/api/migrations/001_init.sql', () => {
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('should define foundation tables conforming to DATABASE_SCHEMA.md', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    // Foundation tables
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?organizations/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?users/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?roles/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?permissions/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?user_roles/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?user_sessions/i)
    expect(sql).toMatch(/CREATE TABLE (IF NOT EXISTS )?audit_logs/i)
  })

  it('should strictly NOT contain account_id (Single Organization Rule)', () => {
    const sql = readFileSync(migrationPath, 'utf-8')
    expect(sql).not.toContain('account_id')
  })

  it('should include required columns for organizations and users', () => {
    const sql = readFileSync(migrationPath, 'utf-8')

    // organizations
    expect(sql).toContain('name VARCHAR')
    expect(sql).toContain('default_locale')
    expect(sql).toContain('timezone')

    // users
    expect(sql).toContain('email VARCHAR')
    expect(sql).toContain('password_hash')
    expect(sql).toContain('display_name')
    expect(sql).toContain('role VARCHAR')
    expect(sql).toContain('availability')
    expect(sql).toContain('active BOOLEAN')
  })
})
