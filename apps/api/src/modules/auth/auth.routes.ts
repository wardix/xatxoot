import { Hono } from 'hono'
import {
  handleGetMe,
  handleGoogleCallback,
  handleLogin,
  handleLogout,
  handleRefresh,
  handleSetup,
} from './auth.controller'
import { authMiddleware } from './auth.middleware'

export const authRoutes = new Hono()

authRoutes.post('/setup', handleSetup)
authRoutes.post('/login', handleLogin)
authRoutes.post('/refresh', handleRefresh)
authRoutes.post('/logout', handleLogout)
authRoutes.get('/google/callback', handleGoogleCallback)
authRoutes.get('/me', authMiddleware, handleGetMe)

export default authRoutes
