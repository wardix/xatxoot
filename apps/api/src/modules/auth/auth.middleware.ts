import type { User } from '@xatxoot/shared'
import type { Context, MiddlewareHandler } from 'hono'
import { verifyUserToken } from './auth.service'

export interface AuthContextVariables {
  user: User
}

export const authMiddleware: MiddlewareHandler = async (c: Context, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.substring(7).trim()
  const user = await verifyUserToken(token)

  if (!user) {
    return c.json({ error: 'Unauthorized: Invalid token' }, 401)
  }

  c.set('user', user)
  await next()
}
