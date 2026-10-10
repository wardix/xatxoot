import { describe, expect, it } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

describe('Phase 1 Migration Idempotency & Execution (Task 1.4)', () => {
  const migrationsDir = join(import.meta.dir, '..', 'apps', 'api', 'migrations')

  it('should export getPendingMigrations and getMigrationStatus from migrate.ts', async () => {
    const migrateModule = await import('../apps/api/src/db/migrate')
    expect(typeof migrateModule.runMigrations).toBe('function')
    expect(typeof migrateModule.getPendingMigrations).toBe('function')
    expect(typeof migrateModule.getMigrationStatus).toBe('function')
  })

  it('should ensure all migration files in apps/api/migrations have idempotent DDL statements', () => {
    const files = readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort()

    expect(files).toContain('001_init.sql')
    expect(files).toContain('002_phase1_inbox.sql')

    for (const file of files) {
      const content = readFileSync(join(migrationsDir, file), 'utf-8')

      // Check all CREATE TABLE have IF NOT EXISTS
      const createTableMatches = content.match(/CREATE TABLE\s+(?!IF NOT EXISTS)\w+/gi) || []
      expect(createTableMatches).toEqual([])

      // Check all CREATE INDEX have IF NOT EXISTS
      const createIndexMatches = content.match(/CREATE INDEX\s+(?!IF NOT EXISTS)\w+/gi) || []
      expect(createIndexMatches).toEqual([])

      // Check all CREATE EXTENSION have IF NOT EXISTS
      const createExtMatches = content.match(/CREATE EXTENSION\s+(?!IF NOT EXISTS)\w+/gi) || []
      expect(createExtMatches).toEqual([])

      // Single organization rule: no account_id
      expect(content).not.toContain('account_id')
    }
  })

  it('should execute migrations sequentially on first run and be idempotent (0 applied) on second run', async () => {
    const { runMigrations, getMigrationStatus } = await import('../apps/api/src/db/migrate')

    const appliedVersions: string[] = []
    const executedStatements: string[] = []

    interface MockSQL {
      (strings: TemplateStringsArray, ...values: unknown[]): Promise<{ version: string }[]>
      unsafe: (statement: string) => Promise<unknown[]>
      file: (filePath: string) => Promise<unknown[]>
    }

    const mockDb = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const raw = strings.join('?')
      if (raw.includes('SELECT version FROM schema_migrations')) {
        return appliedVersions.map((v) => ({ version: v }))
      }
      if (raw.includes('INSERT INTO schema_migrations')) {
        appliedVersions.push(String(values[0]))
        return []
      }
      return []
    }) as unknown as MockSQL

    mockDb.unsafe = async (statement: string) => {
      executedStatements.push(statement)
      return []
    }
    mockDb.file = async (filePath: string) => {
      executedStatements.push(`FILE:${filePath}`)
      return []
    }

    // Status before migrations
    const initialStatus = await getMigrationStatus({
      db: mockDb as unknown as import('bun').SQL,
      migrationsDir,
    })
    expect(initialStatus.applied).toEqual([])
    expect(initialStatus.pending).toContain('001_init.sql')
    expect(initialStatus.pending).toContain('002_phase1_inbox.sql')

    // First execution
    const firstRunApplied = await runMigrations({
      db: mockDb as unknown as import('bun').SQL,
      migrationsDir,
    })
    expect(firstRunApplied).toEqual(['001_init.sql', '002_phase1_inbox.sql'])
    expect(appliedVersions).toEqual(['001_init.sql', '002_phase1_inbox.sql'])

    // Status after first run
    const completedStatus = await getMigrationStatus({
      db: mockDb as unknown as import('bun').SQL,
      migrationsDir,
    })
    expect(completedStatus.applied).toEqual(['001_init.sql', '002_phase1_inbox.sql'])
    expect(completedStatus.pending).toEqual([])

    // Second execution (Idempotent run: must apply 0 migrations)
    const secondRunApplied = await runMigrations({
      db: mockDb as unknown as import('bun').SQL,
      migrationsDir,
    })
    expect(secondRunApplied).toEqual([])
    expect(appliedVersions).toEqual(['001_init.sql', '002_phase1_inbox.sql'])
  })

  it('should verify root and apps/api package.json define db:migrate scripts', () => {
    const rootPkg = JSON.parse(readFileSync(join(import.meta.dir, '..', 'package.json'), 'utf-8'))
    const apiPkg = JSON.parse(
      readFileSync(join(import.meta.dir, '..', 'apps', 'api', 'package.json'), 'utf-8'),
    )

    expect(rootPkg.scripts['db:migrate']).toBe("bun --filter '@xatxoot/api' db:migrate")
    expect(apiPkg.scripts['db:migrate']).toBe('bun run src/db/migrate.ts')
  })
})
