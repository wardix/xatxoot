import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Layout Shell Component (apps/web/src/components/AppShell.tsx)', () => {
  const componentPath = join(
    import.meta.dir,
    '..',
    'apps',
    'web',
    'src',
    'components',
    'AppShell.tsx',
  )

  it('should exist at apps/web/src/components/AppShell.tsx', () => {
    expect(existsSync(componentPath)).toBe(true)
  })

  it('should export AppShell React component', async () => {
    const { AppShell } = await import('../apps/web/src/components/AppShell')
    expect(AppShell).toBeDefined()
    expect(typeof AppShell).toBe('function')
  })

  it('should include Top Bar with organization brand and user session info', () => {
    const source = readFileSync(componentPath, 'utf-8')

    // Top Bar elements
    expect(source).toMatch(/topbar|top-bar|header/i)
    expect(source).toContain('displayName')
    expect(source).toContain('role')
  })

  it('should include user session availability status indicators (online, busy, offline)', () => {
    const source = readFileSync(componentPath, 'utf-8')

    expect(source).toContain('online')
    expect(source).toContain('busy')
    expect(source).toContain('offline')
  })

  it('should include logout functionality and endpoint call to /api/v1/auth/logout', () => {
    const source = readFileSync(componentPath, 'utf-8')

    expect(source).toMatch(/logout/i)
    expect(source).toContain('/api/v1/auth/logout')
  })
})
