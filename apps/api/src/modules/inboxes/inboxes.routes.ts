import { Hono } from 'hono'
import { authMiddleware } from '../auth/auth.middleware'
import {
  handleAddMember,
  handleCreateInbox,
  handleDeleteInbox,
  handleDisconnectSession,
  handleGetChannel,
  handleGetInbox,
  handleGetQrCode,
  handleListInboxes,
  handleListMembers,
  handleRemoveMember,
  handleUpdateInbox,
} from './inboxes.controller'

export const inboxRoutes = new Hono()

// Apply authentication middleware to all inbox endpoints
inboxRoutes.use('*', authMiddleware)

// 1. Inboxes CRUD
inboxRoutes.get('/', handleListInboxes)
inboxRoutes.post('/', handleCreateInbox)
inboxRoutes.get('/:id', handleGetInbox)
inboxRoutes.patch('/:id', handleUpdateInbox)
inboxRoutes.delete('/:id', handleDeleteInbox)

// 2. Channel pairing & status
inboxRoutes.get('/:id/channel', handleGetChannel)
inboxRoutes.get('/:id/channel/whatsapp-unofficial/qr', handleGetQrCode)
inboxRoutes.post('/:id/channel/whatsapp-unofficial/disconnect', handleDisconnectSession)

// 3. Inbox members management
inboxRoutes.get('/:id/members', handleListMembers)
inboxRoutes.post('/:id/members', handleAddMember)
inboxRoutes.delete('/:id/members/:userId', handleRemoveMember)

export default inboxRoutes
