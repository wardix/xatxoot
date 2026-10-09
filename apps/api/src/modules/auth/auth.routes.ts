import { Hono } from 'hono'
import {
  handleGoogleCallback,
  handleLogin,
  handleLogout,
  handleRefresh,
  handleSetup,
} from './auth.controller'

export const authRoutes = new Hono()

authRoutes.post('/setup', handleSetup)
authRoutes.post('/login', handleLogin)
authRoutes.post('/refresh', handleRefresh)
authRoutes.post('/logout', handleLogout)
authRoutes.get('/google/callback', handleGoogleCallback)

export default authRoutes
