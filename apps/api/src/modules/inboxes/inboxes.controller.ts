import { ChannelTypeSchema, SenderNameTypeSchema } from '@xatxoot/shared'
import type { Context } from 'hono'
import { inboxService } from './inboxes.service'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handleListInboxes(c: Context) {
  try {
    const inboxes = await inboxService.listInboxes()
    return c.json(inboxes, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetInbox(c: Context) {
  try {
    const id = c.req.param('id')
    const result = await inboxService.getInboxById(id)
    if (!result) {
      return c.json({ error: 'Inbox tidak ditemukan' }, 404)
    }
    return c.json(result, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleCreateInbox(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}))

    if (!body?.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return c.json({ error: 'Nama inbox wajib diisi' }, 400)
    }

    const channelTypeParse = ChannelTypeSchema.safeParse(body.channelType)
    if (!channelTypeParse.success) {
      return c.json({ error: 'Tipe saluran tidak valid' }, 400)
    }

    if (body.channelType === 'whatsapp_cloud') {
      const channel = body.channel
      if (
        !channel?.phoneNumber ||
        !channel?.phoneNumberId ||
        !channel?.wabaId ||
        !channel?.accessToken ||
        !channel?.webhookVerifyToken
      ) {
        return c.json({ error: 'Kredensial WhatsApp Cloud tidak lengkap' }, 400)
      }
    }

    const result = await inboxService.createInbox(body)
    return c.json(result, 201)
  } catch (err) {
    if (err instanceof Error) {
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleUpdateInbox(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))

    if (body.senderNameType !== undefined) {
      const senderParse = SenderNameTypeSchema.safeParse(body.senderNameType)
      if (!senderParse.success) {
        return c.json({ error: 'Tipe nama pengirim tidak valid' }, 400)
      }
    }

    const updated = await inboxService.updateInbox(id, body)
    if (!updated) {
      return c.json({ error: 'Inbox tidak ditemukan' }, 404)
    }

    return c.json({ inbox: updated }, 200)
  } catch (err) {
    if (err instanceof Error) {
      return c.json({ error: err.message }, 400)
    }
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleDeleteInbox(c: Context) {
  try {
    const id = c.req.param('id')
    const deleted = await inboxService.deleteInbox(id)
    if (!deleted) {
      return c.json({ error: 'Inbox tidak ditemukan' }, 404)
    }
    return c.json({ success: true, message: 'Inbox berhasil dihapus' }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetChannel(c: Context) {
  try {
    const id = c.req.param('id')
    const channelDetails = await inboxService.getChannelDetails(id)
    if (!channelDetails) {
      return c.json({ error: 'Saluran tidak ditemukan' }, 404)
    }
    return c.json(channelDetails, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleGetQrCode(c: Context) {
  try {
    const id = c.req.param('id')
    const qrInfo = await inboxService.getQrCode(id)
    if (!qrInfo) {
      return c.json({ error: 'Saluran tidak valid atau tidak mendukung QR code' }, 404)
    }
    return c.json(qrInfo, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleDisconnectSession(c: Context) {
  try {
    const id = c.req.param('id')
    const result = await inboxService.disconnectChannel(id)
    if (!result) {
      return c.json({ error: 'Saluran tidak valid' }, 404)
    }
    return c.json(result, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleListMembers(c: Context) {
  try {
    const id = c.req.param('id')
    const members = await inboxService.listInboxMembers(id)
    return c.json(members, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleAddMember(c: Context) {
  try {
    const id = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const userId = body?.userId

    if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
      return c.json({ error: 'User ID tidak valid (harus berupa UUID)' }, 400)
    }

    const member = await inboxService.addInboxMember(id, userId)
    return c.json(member, 201)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}

export async function handleRemoveMember(c: Context) {
  try {
    const id = c.req.param('id')
    const userId = c.req.param('userId')
    await inboxService.removeInboxMember(id, userId)
    return c.json({ success: true, message: 'Anggota berhasil dihapus dari inbox' }, 200)
  } catch {
    return c.json({ error: 'Internal Server Error' }, 500)
  }
}
