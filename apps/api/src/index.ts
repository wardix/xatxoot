import { Hono } from 'hono'
import { authRoutes } from './modules/auth/auth.routes'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.route('/api/v1/auth', authRoutes)

export default app
