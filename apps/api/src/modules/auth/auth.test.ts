import { describe, expect, it } from 'bun:test'
import app from '../../index'
import { hashPassword, isGoogleDomainAllowed, verifyPassword } from './auth.service'

describe('Auth Module - Password Hashing (Argon2id)', () => {
  it('should hash password using argon2id algorithm', async () => {
    const password = 'SecurePassword123!'
    const hash = await hashPassword(password)
    expect(hash).toBeDefined()
    expect(typeof hash).toBe('string')
    expect(hash.startsWith('$argon2id$')).toBe(true)
  })

  it('should verify correct password successfully', async () => {
    const password = 'SecurePassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword(password, hash)
    expect(isValid).toBe(true)
  })

  it('should reject incorrect password', async () => {
    const password = 'SecurePassword123!'
    const hash = await hashPassword(password)
    const isValid = await verifyPassword('WrongPassword!', hash)
    expect(isValid).toBe(false)
  })
})

describe('Auth Module - Google Domain Restriction', () => {
  it('should allow emails from configured allowed domains', () => {
    const allowedDomains = ['example.com', 'acme.org']
    expect(isGoogleDomainAllowed('admin@example.com', allowedDomains)).toBe(true)
    expect(isGoogleDomainAllowed('user@acme.org', allowedDomains)).toBe(true)
  })

  it('should reject emails from domains not in allowed list', () => {
    const allowedDomains = ['example.com', 'acme.org']
    expect(isGoogleDomainAllowed('hacker@gmail.com', allowedDomains)).toBe(false)
    expect(isGoogleDomainAllowed('attacker@random.net', allowedDomains)).toBe(false)
  })

  it('should allow all domains if allowed list is empty or wildcard', () => {
    expect(isGoogleDomainAllowed('user@gmail.com', [])).toBe(true)
    expect(isGoogleDomainAllowed('user@gmail.com', ['*'])).toBe(true)
  })
})

describe('Auth Endpoints Integration', () => {
  describe('POST /api/v1/auth/setup', () => {
    it('should successfully setup initial organization and first admin', async () => {
      const res = await app.request('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Acme Corporation',
          adminName: 'Owner Admin',
          adminEmail: 'admin@acme.corp',
          adminPassword: 'SuperSecret123!',
          timezone: 'Asia/Jakarta',
          defaultLocale: 'id',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.organization).toBeDefined()
      expect(data.organization.name).toBe('Acme Corporation')
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('admin@acme.corp')
      expect(data.user.role).toBe('owner')
      expect(data.tokens).toBeDefined()
      expect(data.tokens.accessToken).toBeDefined()
      expect(data.tokens.refreshToken).toBeDefined()
    })

    it('should reject setup with invalid input (short password or bad email)', async () => {
      const res = await app.request('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Acme',
          adminName: 'Admin',
          adminEmail: 'invalid-email',
          adminPassword: '123',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('should reject setup if organization already exists (singleton instance)', async () => {
      const res = await app.request('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Second Org',
          adminName: 'Second Admin',
          adminEmail: 'second@acme.corp',
          adminPassword: 'SuperSecret123!',
        }),
      })

      expect([400, 409]).toContain(res.status)
    })
  })

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials and return tokens', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@acme.corp',
          password: 'SuperSecret123!',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.user).toBeDefined()
      expect(data.tokens).toBeDefined()
      expect(data.tokens.accessToken).toBeDefined()
      expect(data.tokens.refreshToken).toBeDefined()
    })

    it('should return 401 for incorrect password', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@acme.corp',
          password: 'WrongPassword123!',
        }),
      })

      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toBeDefined()
    })

    it('should return 401 for non-existent email', async () => {
      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@acme.corp',
          password: 'SomePassword123!',
        }),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/v1/auth/refresh & POST /api/v1/auth/logout', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const res = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'valid-refresh-token',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.tokens).toBeDefined()
      expect(data.tokens.accessToken).toBeDefined()
    })

    it('should reject invalid refresh token with 401', async () => {
      const res = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'invalid-or-expired-token',
        }),
      })

      expect(res.status).toBe(401)
    })

    it('should logout and invalidate session', async () => {
      const res = await app.request('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-access-token',
        },
        body: JSON.stringify({
          refreshToken: 'valid-refresh-token',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
    })
  })

  describe('Google OAuth Domain Restriction Callback', () => {
    it('should reject OAuth callback if user email domain is unauthorized', async () => {
      const res = await app.request('/api/v1/auth/google/callback?code=mock-code-unauthorized', {
        method: 'GET',
      })

      expect([401, 403]).toContain(res.status)
    })
  })
})
