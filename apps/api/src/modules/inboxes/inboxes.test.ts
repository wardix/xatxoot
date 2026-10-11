import { beforeEach, describe, expect, it } from 'bun:test'
import app from '../../index'
import {
  type CreateInboxInput,
  type CreateWhatsAppCloudChannelInput,
  type CreateWhatsAppUnofficialChannelInput,
  inboxService,
} from './inboxes.service'

const AUTH_HEADER = {
  Authorization: 'Bearer valid-access-token',
}

describe('Inboxes Module - Auth Guard', () => {
  it('GET /api/v1/inboxes should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/inboxes', {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('POST /api/v1/inboxes should reject requests without Authorization header with 401', async () => {
    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthenticated Inbox', channelType: 'whatsapp_cloud' }),
    })
    expect(res.status).toBe(401)
  })

  it('GET /api/v1/inboxes/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/inboxes/${fakeId}`, {
      method: 'GET',
    })
    expect(res.status).toBe(401)
  })

  it('PATCH /api/v1/inboxes/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/inboxes/${fakeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })
    expect(res.status).toBe(401)
  })

  it('DELETE /api/v1/inboxes/:id should reject requests without Authorization header with 401', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await app.request(`/api/v1/inboxes/${fakeId}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(401)
  })
})

describe('Inboxes Module - Create Inbox (POST /api/v1/inboxes)', () => {
  it('should reject creation if name is missing or empty', async () => {
    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: '',
        channelType: 'whatsapp_cloud',
      }),
    })
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should reject creation if channelType is invalid', async () => {
    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Invalid Channel Inbox',
        channelType: 'invalid_type',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('should create WhatsApp Cloud inbox and initialize channels_whatsapp_cloud', async () => {
    const payload = {
      name: 'WhatsApp Official Customer Support',
      channelType: 'whatsapp_cloud',
      enableAutoAssign: true,
      greetingEnabled: true,
      greetingMessage: 'Halo! Selamat datang di Customer Service Resmi kami.',
      channel: {
        phoneNumber: '+6281122334455',
        phoneNumberId: '109922334455667',
        wabaId: '809922334455667',
        accessToken: 'EAAB_mock_meta_cloud_permanent_access_token_xyz',
        webhookVerifyToken: 'meta_verify_token_super_secret_123',
      },
    }

    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.inbox).toBeDefined()
    expect(data.inbox.id).toBeDefined()
    expect(data.inbox.name).toBe(payload.name)
    expect(data.inbox.channelType).toBe('whatsapp_cloud')
    expect(data.inbox.channelId).toBeDefined()
    expect(data.inbox.enableAutoAssign).toBe(true)
    expect(data.inbox.greetingEnabled).toBe(true)
    expect(data.inbox.greetingMessage).toBe(payload.greetingMessage)
    expect(data.channel).toBeDefined()
    expect(data.channel.phoneNumber).toBe(payload.channel.phoneNumber)
    expect(data.channel.phoneNumberId).toBe(payload.channel.phoneNumberId)
    expect(data.channel.wabaId).toBe(payload.channel.wabaId)
  })

  it('should reject WhatsApp Cloud creation when required channel fields are missing', async () => {
    const payload = {
      name: 'WhatsApp Official Broken',
      channelType: 'whatsapp_cloud',
      channel: {
        phoneNumber: '+6281122334455',
        // Missing phoneNumberId, wabaId, accessToken, webhookVerifyToken
      },
    }

    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('should create WhatsApp Unofficial (Baileys) inbox and initialize channel record', async () => {
    const payload = {
      name: 'WhatsApp Unofficial CS Toko',
      channelType: 'whatsapp_unofficial',
      enableAutoAssign: false,
      channel: {
        sessionId: 'baileys-session-toko-primary',
        phoneNumber: '+6281298765432',
      },
    }

    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.inbox).toBeDefined()
    expect(data.inbox.name).toBe(payload.name)
    expect(data.inbox.channelType).toBe('whatsapp_unofficial')
    expect(data.channel).toBeDefined()
    expect(data.channel.sessionId).toBe(payload.channel.sessionId)
    expect(data.channel.connectionStatus).toBe('disconnected')
  })

  it('should create Web Widget inbox with auto-generated websiteToken', async () => {
    const payload = {
      name: 'Website Widget Main Site',
      channelType: 'web_widget',
      channel: {
        websiteUrl: 'https://example.org',
        widgetColor: '#25D366',
        replyTime: 'in_a_few_minutes',
      },
    }

    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.inbox.channelType).toBe('web_widget')
    expect(data.channel.websiteToken).toBeDefined()
    expect(data.channel.widgetColor).toBe('#25D366')
  })

  it('should create API channel inbox', async () => {
    const payload = {
      name: 'Custom Backend Integration API',
      channelType: 'api',
      channel: {
        webhookUrl: 'https://api.internal.corp/webhook',
      },
    }

    const res = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.inbox.channelType).toBe('api')
  })
})

describe('Inboxes Module - List and Read Inbox (GET /api/v1/inboxes)', () => {
  it('should list all registered inboxes', async () => {
    const res = await app.request('/api/v1/inboxes', {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('should retrieve single inbox detail by valid ID', async () => {
    // 1. Create an inbox first
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Lookup Target Inbox',
        channelType: 'whatsapp_unofficial',
        channel: {
          sessionId: `session-lookup-${Date.now()}`,
        },
      }),
    })
    const created = await createRes.json()
    const targetId = created.inbox.id

    // 2. Fetch by ID
    const getRes = await app.request(`/api/v1/inboxes/${targetId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(getRes.status).toBe(200)
    const getBody = await getRes.json()
    expect(getBody.inbox).toBeDefined()
    expect(getBody.inbox.id).toBe(targetId)
    expect(getBody.inbox.name).toBe('Lookup Target Inbox')
    expect(getBody.channel).toBeDefined()
  })

  it('should return 404 for non-existent inbox ID', async () => {
    const nonExistentId = '99999999-9999-9999-9999-999999999999'
    const res = await app.request(`/api/v1/inboxes/${nonExistentId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })
})

describe('Inboxes Module - Update Inbox (PATCH /api/v1/inboxes/:id)', () => {
  it('should update inbox attributes successfully', async () => {
    // 1. Create an inbox
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Original Inbox Name',
        channelType: 'whatsapp_unofficial',
        enableAutoAssign: true,
        channel: {
          sessionId: `session-update-${Date.now()}`,
        },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    // 2. Update properties
    const patchRes = await app.request(`/api/v1/inboxes/${inboxId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Updated Inbox Name',
        enableAutoAssign: false,
        greetingEnabled: true,
        greetingMessage: 'Pesan sambutan baru',
        workingHoursEnabled: true,
        outOfOfficeMessage: 'Saat ini kantor kami sedang tutup',
      }),
    })

    expect(patchRes.status).toBe(200)
    const patchedData = await patchRes.json()
    expect(patchedData.inbox.name).toBe('Updated Inbox Name')
    expect(patchedData.inbox.enableAutoAssign).toBe(false)
    expect(patchedData.inbox.greetingEnabled).toBe(true)
    expect(patchedData.inbox.greetingMessage).toBe('Pesan sambutan baru')
    expect(patchedData.inbox.workingHoursEnabled).toBe(true)
    expect(patchedData.inbox.outOfOfficeMessage).toBe('Saat ini kantor kami sedang tutup')
  })

  it('should reject update with invalid senderNameType', async () => {
    const dummyId = '00000000-0000-0000-0000-000000000002'
    const res = await app.request(`/api/v1/inboxes/${dummyId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        senderNameType: 'invalid_mode',
      }),
    })

    expect(res.status).toBe(400)
  })

  it('should return 404 when patching non-existent inbox', async () => {
    const nonExistentId = '88888888-8888-8888-8888-888888888888'
    const res = await app.request(`/api/v1/inboxes/${nonExistentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Will Fail',
      }),
    })

    expect(res.status).toBe(404)
  })
})

describe('Inboxes Module - Delete Inbox (DELETE /api/v1/inboxes/:id)', () => {
  it('should delete inbox and verify subsequent GET returns 404', async () => {
    // 1. Create inbox
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'To Be Deleted Inbox',
        channelType: 'whatsapp_unofficial',
        channel: {
          sessionId: `session-delete-${Date.now()}`,
        },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    // 2. Delete inbox
    const deleteRes = await app.request(`/api/v1/inboxes/${inboxId}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect([200, 204]).toContain(deleteRes.status)

    // 3. Verify GET returns 404
    const verifyRes = await app.request(`/api/v1/inboxes/${inboxId}`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(verifyRes.status).toBe(404)
  })

  it('should return 404 when deleting non-existent inbox', async () => {
    const nonExistentId = '77777777-7777-7777-7777-777777777777'
    const res = await app.request(`/api/v1/inboxes/${nonExistentId}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(res.status).toBe(404)
  })
})

describe('Inboxes Module - Channel Pairing & Status Details', () => {
  it('GET /api/v1/inboxes/:id/channel should return WhatsApp Cloud pairing info and webhook credentials', async () => {
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'WA Cloud Pairing Test',
        channelType: 'whatsapp_cloud',
        channel: {
          phoneNumber: '+6281234560000',
          phoneNumberId: 'phone_id_999888',
          wabaId: 'waba_id_777666',
          accessToken: 'access_token_mock',
          webhookVerifyToken: 'verify_token_sample_123',
        },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    const channelRes = await app.request(`/api/v1/inboxes/${inboxId}/channel`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(channelRes.status).toBe(200)
    const channelData = await channelRes.json()
    expect(channelData.channelType).toBe('whatsapp_cloud')
    expect(channelData.phoneNumberId).toBe('phone_id_999888')
    expect(channelData.webhookVerifyToken).toBe('verify_token_sample_123')
    expect(channelData.webhookCallbackUrl).toBeDefined()
  })

  it('GET /api/v1/inboxes/:id/channel should return WhatsApp Unofficial connection status and sessionId', async () => {
    const sessionId = `baileys-status-${Date.now()}`
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'WA Baileys Pairing Test',
        channelType: 'whatsapp_unofficial',
        channel: {
          sessionId,
          phoneNumber: '+628998877665',
        },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    const channelRes = await app.request(`/api/v1/inboxes/${inboxId}/channel`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(channelRes.status).toBe(200)
    const channelData = await channelRes.json()
    expect(channelData.channelType).toBe('whatsapp_unofficial')
    expect(channelData.sessionId).toBe(sessionId)
    expect(channelData.connectionStatus).toBeDefined()
  })

  it('GET /api/v1/inboxes/:id/channel/whatsapp-unofficial/qr should return QR code state', async () => {
    const sessionId = `baileys-qr-${Date.now()}`
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'WA Baileys QR Test',
        channelType: 'whatsapp_unofficial',
        channel: { sessionId },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    const qrRes = await app.request(`/api/v1/inboxes/${inboxId}/channel/whatsapp-unofficial/qr`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })

    expect(qrRes.status).toBe(200)
    const qrData = await qrRes.json()
    expect(qrData.sessionId).toBe(sessionId)
    expect(qrData.connectionStatus).toBeDefined()
  })

  it('POST /api/v1/inboxes/:id/channel/whatsapp-unofficial/disconnect should disconnect Baileys session', async () => {
    const sessionId = `baileys-disconnect-${Date.now()}`
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'WA Baileys Disconnect Test',
        channelType: 'whatsapp_unofficial',
        channel: { sessionId },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    const disconnectRes = await app.request(
      `/api/v1/inboxes/${inboxId}/channel/whatsapp-unofficial/disconnect`,
      {
        method: 'POST',
        headers: AUTH_HEADER,
      },
    )

    expect(disconnectRes.status).toBe(200)
    const resData = await disconnectRes.json()
    expect(resData.success).toBe(true)
    expect(resData.connectionStatus).toBe('disconnected')
  })
})

describe('Inboxes Module - Inbox Members Management (/api/v1/inboxes/:id/members)', () => {
  it('should manage agent assignment to inbox (list, add, and remove)', async () => {
    // 1. Create inbox
    const createRes = await app.request('/api/v1/inboxes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        name: 'Agent Assignment Test Inbox',
        channelType: 'whatsapp_unofficial',
        channel: {
          sessionId: `baileys-members-${Date.now()}`,
        },
      }),
    })
    const created = await createRes.json()
    const inboxId = created.inbox.id

    // 2. Initially members list is empty
    const initialListRes = await app.request(`/api/v1/inboxes/${inboxId}/members`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(initialListRes.status).toBe(200)
    const initialMembers = await initialListRes.json()
    expect(Array.isArray(initialMembers)).toBe(true)
    expect(initialMembers.length).toBe(0)

    // 3. Add agent member
    const targetUserId = '11111111-2222-3333-4444-555555555555'
    const addRes = await app.request(`/api/v1/inboxes/${inboxId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        userId: targetUserId,
      }),
    })
    expect([200, 201]).toContain(addRes.status)

    // 4. Verify member is listed
    const afterAddRes = await app.request(`/api/v1/inboxes/${inboxId}/members`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    expect(afterAddRes.status).toBe(200)
    const membersAfter = await afterAddRes.json()
    expect(membersAfter.length).toBe(1)
    expect(membersAfter[0].userId).toBe(targetUserId)

    // 5. Remove member
    const removeRes = await app.request(`/api/v1/inboxes/${inboxId}/members/${targetUserId}`, {
      method: 'DELETE',
      headers: AUTH_HEADER,
    })
    expect(removeRes.status).toBe(200)

    // 6. Verify members list is empty again
    const finalRes = await app.request(`/api/v1/inboxes/${inboxId}/members`, {
      method: 'GET',
      headers: AUTH_HEADER,
    })
    const finalMembers = await finalRes.json()
    expect(finalMembers.length).toBe(0)
  })

  it('should reject adding member with invalid userId format', async () => {
    const dummyId = '00000000-0000-0000-0000-000000000003'
    const res = await app.request(`/api/v1/inboxes/${dummyId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...AUTH_HEADER,
      },
      body: JSON.stringify({
        userId: 'not-a-uuid',
      }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Inboxes Module - Service Level Contract (inboxService)', () => {
  it('should expose complete CRUD and pairing methods on inboxService', async () => {
    expect(inboxService).toBeDefined()
    expect(typeof inboxService.createInbox).toBe('function')
    expect(typeof inboxService.getInboxById).toBe('function')
    expect(typeof inboxService.listInboxes).toBe('function')
    expect(typeof inboxService.updateInbox).toBe('function')
    expect(typeof inboxService.deleteInbox).toBe('function')
    expect(typeof inboxService.addInboxMember).toBe('function')
    expect(typeof inboxService.removeInboxMember).toBe('function')
    expect(typeof inboxService.listInboxMembers).toBe('function')
    expect(typeof inboxService.getChannelDetails).toBe('function')
  })
})
