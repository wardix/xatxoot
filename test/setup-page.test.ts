import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('SetupPage Component (apps/web/src/pages/SetupPage.tsx)', () => {
  const pagePath = join(import.meta.dir, '..', 'apps', 'web', 'src', 'pages', 'SetupPage.tsx')

  it('should exist at apps/web/src/pages/SetupPage.tsx', () => {
    expect(existsSync(pagePath)).toBe(true)
  })

  it('should export SetupPage React component', async () => {
    const { SetupPage } = await import('../apps/web/src/pages/SetupPage')
    expect(SetupPage).toBeDefined()
    expect(typeof SetupPage).toBe('function')
  })

  it('should include form fields matching OrganizationSetupInputSchema', () => {
    const source = readFileSync(pagePath, 'utf-8')

    // Key input names/labels
    expect(source).toContain('organizationName')
    expect(source).toContain('adminName')
    expect(source).toContain('adminEmail')
    expect(source).toContain('adminPassword')
    expect(source).toContain('timezone')
    expect(source).toContain('defaultLocale')
  })

  it('should contain form submit handler and API endpoint call to /api/v1/auth/setup', () => {
    const source = readFileSync(pagePath, 'utf-8')

    expect(source).toContain('/api/v1/auth/setup')
    expect(source).toMatch(/handleSubmit|onSubmit/i)
  })
})
