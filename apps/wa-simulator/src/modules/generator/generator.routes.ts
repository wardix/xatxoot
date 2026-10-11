import { Hono } from 'hono'
import { dispatchWebhook } from './webhook-dispatcher'
import { webhookHistoryStore } from './webhook-history-store'
import {
  type InboundMessageOptions,
  type StatusReceiptOptions,
  buildInboundMessagePayload,
  buildStatusReceiptPayload,
} from './webhook-payload-builder'

export const generatorRoutes = new Hono()

const DEFAULT_TARGET_URL =
  process.env.API_WEBHOOK_URL || 'http://localhost:3000/api/v1/webhooks/whatsapp-cloud'
const DEFAULT_APP_SECRET = process.env.WHATSAPP_CLOUD_APP_SECRET || 'xatxoot_app_secret'

generatorRoutes.post('/simulator/webhook/generate', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as InboundMessageOptions & {
    targetUrl?: string
    appSecret?: string
  }

  if (!body.customerPhone || body.customerPhone.trim() === '') {
    return c.json({ error: 'Field customerPhone is required.' }, 400)
  }

  const payload = buildInboundMessagePayload(body)
  const messageEntry = (payload.entry as Record<string, unknown>[])?.[0]
  const changes = (messageEntry?.changes as Record<string, unknown>[])?.[0]
  const value = changes?.value as Record<string, unknown>
  const messages = value?.messages as Record<string, unknown>[]
  const messageId = String(messages?.[0]?.id || '')

  const targetUrl = body.targetUrl || DEFAULT_TARGET_URL
  const appSecret = body.appSecret || DEFAULT_APP_SECRET

  const dispatchResult = await dispatchWebhook({
    targetUrl,
    payload,
    appSecret,
    type: 'inbound',
    messageId,
  })

  return c.json({
    success: dispatchResult.success,
    statusCode: dispatchResult.statusCode,
    messageId,
    signature: dispatchResult.signature,
    payload: dispatchResult.payload,
  })
})

generatorRoutes.post('/simulator/webhook/status', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as StatusReceiptOptions & {
    targetUrl?: string
    appSecret?: string
  }

  if (!body.messageId || !body.status) {
    return c.json({ error: 'Fields messageId and status are required.' }, 400)
  }

  const payload = buildStatusReceiptPayload(body)
  const targetUrl = body.targetUrl || DEFAULT_TARGET_URL
  const appSecret = body.appSecret || DEFAULT_APP_SECRET

  const dispatchResult = await dispatchWebhook({
    targetUrl,
    payload,
    appSecret,
    type: 'status',
    messageId: body.messageId,
  })

  return c.json({
    success: dispatchResult.success,
    statusCode: dispatchResult.statusCode,
    signature: dispatchResult.signature,
    payload: dispatchResult.payload,
  })
})

generatorRoutes.get('/simulator/webhook/history', (c) => {
  return c.json({ data: webhookHistoryStore.getAll() })
})

generatorRoutes.delete('/simulator/webhook/history', (c) => {
  webhookHistoryStore.clear()
  return c.json({ success: true })
})

// Mini-UI Web Dashboard (FR-WS-3)
const renderMiniHtml = () => `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Cloud API Simulator — Xatxoot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 20px; color: #111b21; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(11,20,26,.15); overflow: hidden; }
    .header { background: #00a884; color: #fff; padding: 16px 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 24px; }
    .form-group { margin-bottom: 16px; }
    label { display: block; font-weight: 600; margin-bottom: 6px; font-size: 14px; }
    input, select, textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #d1d7db; border-radius: 6px; font-size: 14px; }
    button { background: #00a884; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 14px; }
    button:hover { background: #008f6f; }
    .status-box { margin-top: 20px; padding: 12px; background: #f8f9fa; border-left: 4px solid #00a884; border-radius: 4px; font-size: 13px; font-family: monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>WhatsApp Cloud API Simulator</h1>
    </div>
    <div class="content">
      <div class="form-group">
        <label for="targetUrl">Target Webhook URL (Backend Xatxoot):</label>
        <input type="text" id="targetUrl" value="http://localhost:3000/api/v1/webhooks/whatsapp-cloud">
      </div>
      <div class="form-group">
        <label for="customerPhone">Nomor WhatsApp Pelanggan (customerPhone):</label>
        <input type="text" id="customerPhone" value="6281234567890">
      </div>
      <div class="form-group">
        <label for="customerName">Nama Pelanggan:</label>
        <input type="text" id="customerName" value="Pelanggan Uji Coba">
      </div>
      <div class="form-group">
        <label for="type">Tipe Pesan:</label>
        <select id="type">
          <option value="text">Teks Biasa</option>
          <option value="image">Gambar / Foto</option>
        </select>
      </div>
      <div class="form-group">
        <label for="text">Isi Pesan:</label>
        <textarea id="text" rows="3">Halo, saya ingin bertanya tentang produk Anda.</textarea>
      </div>
      <button type="button" id="sendBtn">Kirim Pesan Pelanggan (Simulasi Inbound)</button>
      <div id="result" class="status-box" style="display: none;"></div>
    </div>
  </div>
  <script>
    document.getElementById('sendBtn').addEventListener('click', async () => {
      const resultBox = document.getElementById('result');
      resultBox.style.display = 'block';
      resultBox.textContent = 'Mengirim simulasi webhook...';
      try {
        const res = await fetch('/simulator/webhook/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: document.getElementById('targetUrl').value,
            customerPhone: document.getElementById('customerPhone').value,
            customerName: document.getElementById('customerName').value,
            type: document.getElementById('type').value,
            text: document.getElementById('text').value,
          })
        });
        const data = await res.json();
        resultBox.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        resultBox.textContent = 'Error: ' + err.message;
      }
    });
  </script>
</body>
</html>`

generatorRoutes.get('/', (c) => c.html(renderMiniHtml()))
generatorRoutes.get('/simulator', (c) => c.html(renderMiniHtml()))
