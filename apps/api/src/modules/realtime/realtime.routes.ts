import { Hono } from 'hono'
import { handleStream } from './realtime.controller'

export const realtimeRoutes = new Hono()

realtimeRoutes.get('/stream', handleStream)

export default realtimeRoutes
