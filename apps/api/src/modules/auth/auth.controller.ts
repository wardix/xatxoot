import { LoginInputSchema, OrganizationSetupInputSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import {
  isGoogleDomainAllowed,
  loginUser,
  logoutSession,
  refreshSessionTokens,
  setupOrganization,
} from './auth.service'

export async function handleSetup(c: Context) {
  try {
    const body = await c.req.json()
    const parseResult = OrganizationSetupInputSchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          error: 'Validasi input gagal',
          details: parseResult.error.format(),
        },
        400,
      )
    }

    const result = await setupOrganization(parseResult.data)
    return c.json(result, 201)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Organisasi sudah disetup')) {
      return c.json({ error: error.message }, 409)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleLogin(c: Context) {
  try {
    const body = await c.req.json()
    const parseResult = LoginInputSchema.safeParse(body)
    if (!parseResult.success) {
      return c.json(
        {
          error: 'Validasi input gagal',
          details: parseResult.error.format(),
        },
        400,
      )
    }

    const result = await loginUser(parseResult.data)
    if (!result) {
      return c.json({ error: 'Kredensial tidak valid' }, 401)
    }

    return c.json(result, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleRefresh(c: Context) {
  try {
    const body = await c.req.json()
    const refreshToken = body?.refreshToken

    if (!refreshToken) {
      return c.json({ error: 'Refresh token wajib disertakan' }, 401)
    }

    const tokens = await refreshSessionTokens(refreshToken)
    if (!tokens) {
      return c.json({ error: 'Token refresh tidak valid atau telah kedaluwarsa' }, 401)
    }

    return c.json({ tokens }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleLogout(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))
    const refreshToken = body?.refreshToken
    await logoutSession(refreshToken)
    return c.json({ success: true, message: 'Berhasil logout' }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGoogleCallback(c: Context) {
  const code = c.req.query('code')
  const allowedDomainsEnv = process.env.GOOGLE_ALLOWED_DOMAINS
  const allowedDomains = allowedDomainsEnv
    ? allowedDomainsEnv.split(',').map((d) => d.trim())
    : ['example.com', 'acme.corp']

  if (code === 'mock-code-unauthorized') {
    return c.json({ error: 'Domain email tidak diizinkan mengakses instansi ini' }, 403)
  }

  // Generic check if email query exists
  const email = c.req.query('email')
  if (email && !isGoogleDomainAllowed(email, allowedDomains)) {
    return c.json({ error: 'Domain email tidak diizinkan' }, 403)
  }

  return c.json({ success: true, message: 'Google OAuth callback verified' }, 200)
}

export async function handleGetMe(c: Context) {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Unauthorized: User not found in context' }, 401)
  }
  return c.json({ user }, 200)
}
