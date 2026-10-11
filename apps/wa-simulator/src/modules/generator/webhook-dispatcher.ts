import { webhookHistoryStore } from './webhook-history-store'
import { generateMetaSignature } from './webhook-payload-builder'

export interface DispatchOptions {
  targetUrl: string
  payload: Record<string, unknown>
  appSecret: string
  type?: 'inbound' | 'status'
  messageId?: string
}

export interface DispatchResult {
  success: boolean
  statusCode: number
  signature: string
  payload: Record<string, unknown>
  responseBody?: string
  error?: string
}

export async function dispatchWebhook(options: DispatchOptions): Promise<DispatchResult> {
  const payloadJson = JSON.stringify(options.payload)
  const signature = generateMetaSignature(payloadJson, options.appSecret)

  try {
    const res = await fetch(options.targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'User-Agent': 'WhatsApp/2.23.24.14 i',
      },
      body: payloadJson,
    })

    const responseBody = await res.text().catch(() => '')
    const success = res.ok

    webhookHistoryStore.add({
      id: crypto.randomUUID(),
      type: options.type || 'inbound',
      messageId: options.messageId || 'unknown',
      targetUrl: options.targetUrl,
      statusCode: res.status,
      createdAt: new Date().toISOString(),
      payload: options.payload,
    })

    return {
      success,
      statusCode: res.status,
      signature,
      payload: options.payload,
      responseBody,
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    webhookHistoryStore.add({
      id: crypto.randomUUID(),
      type: options.type || 'inbound',
      messageId: options.messageId || 'unknown',
      targetUrl: options.targetUrl,
      statusCode: 500,
      createdAt: new Date().toISOString(),
      payload: options.payload,
      error: errorMsg,
    })

    return {
      success: false,
      statusCode: 500,
      signature,
      payload: options.payload,
      error: errorMsg,
    }
  }
}
