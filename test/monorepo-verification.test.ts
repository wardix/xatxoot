import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

describe('Monorepo Quality Gate Verification (Phase 0 Complete)', () => {
  const rootDir = join(import.meta.dir, '..')

  it('should verify all required workspace directories exist', () => {
    expect(existsSync(join(rootDir, 'apps', 'api'))).toBe(true)
    expect(existsSync(join(rootDir, 'apps', 'web'))).toBe(true)
    expect(existsSync(join(rootDir, 'packages', 'shared'))).toBe(true)
  })

  it('should verify root configuration and infrastructure files exist', () => {
    expect(existsSync(join(rootDir, 'package.json'))).toBe(true)
    expect(existsSync(join(rootDir, 'biome.json'))).toBe(true)
    expect(existsSync(join(rootDir, 'tsconfig.base.json'))).toBe(true)
    expect(existsSync(join(rootDir, 'docker-compose.dev.yml'))).toBe(true)
    expect(existsSync(join(rootDir, '.env.example'))).toBe(true)
  })

  it('should verify test directory contains all expected Phase 0 test suites', () => {
    const testDir = join(rootDir, 'test')
    const testFiles = readdirSync(testDir)

    expect(testFiles).toContain('root-package.test.ts')
    expect(testFiles).toContain('biome-config.test.ts')
    expect(testFiles).toContain('tsconfig-base.test.ts')
    expect(testFiles).toContain('docker-compose-dev.test.ts')
    expect(testFiles).toContain('env-example.test.ts')
    expect(testFiles).toContain('shared-package.test.ts')
    expect(testFiles).toContain('api-package.test.ts')
    expect(testFiles).toContain('db-connection.test.ts')
    expect(testFiles).toContain('migration-runner.test.ts')
    expect(testFiles).toContain('init-migration.test.ts')
    expect(testFiles).toContain('web-package.test.ts')
    expect(testFiles).toContain('setup-page.test.ts')
    expect(testFiles).toContain('login-page.test.ts')
    expect(testFiles).toContain('layout-shell.test.ts')
  })
})
