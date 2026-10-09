import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('LoginPage Component (apps/web/src/pages/LoginPage.tsx)', () => {
  const pagePath = join(import.meta.dir, '..', 'apps', 'web', 'src', 'pages', 'LoginPage.tsx')

  it('should exist at apps/web/src/pages/LoginPage.tsx', () => {
    expect(existsSync(pagePath)).toBe(true)
  })

  it('should export LoginPage React component', async () => {
    const { LoginPage } = await import('../apps/web/src/pages/LoginPage')
    expect(LoginPage).toBeDefined()
    expect(typeof LoginPage).toBe('function')
  })

  it('should include email and password form fields matching LoginInputSchema', () => {
    const source = readFileSync(pagePath, 'utf-8')

    expect(source).toContain('name="email"')
    expect(source).toContain('name="password"')
    expect(source).toContain('type="password"')
  })

  it('should contain form submit handler and API endpoint call to /api/v1/auth/login', () => {
    const source = readFileSync(pagePath, 'utf-8')

    expect(source).toContain('/api/v1/auth/login')
    expect(source).toMatch(/handleSubmit|onSubmit/i)
  })

  it('should include Google SSO login button with Google branding/icon', () => {
    const source = readFileSync(pagePath, 'utf-8')

    expect(source).toMatch(/google/i)
    expect(source).toMatch(/sso|oauth/i)
  })
})
