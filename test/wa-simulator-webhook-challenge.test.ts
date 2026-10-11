import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('WhatsApp Simulator Webhook Challenge Verification (Task 1.8)', () => {
  const simulatorDir = join(import.meta.dir, '..', 'apps', 'wa-simulator')
  const pkgPath = join(simulatorDir, 'package.json')
  const tsconfigPath = join(simulatorDir, 'tsconfig.json')
  const indexPath = join(simulatorDir, 'src', 'index.ts')

  it('should have apps/wa-simulator package structure with Hono dependencies', () => {
    expect(existsSync(pkgPath)).toBe(true)
    expect(existsSync(tsconfigPath)).toBe(true)
    expect(existsSync(indexPath)).toBe(true)

    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    expect(pkg.name).toBe('@xatxoot/wa-simulator')
    expect(pkg.dependencies.hono).toBeDefined()
  })

  it('should export verifyWebhookChallenge helper function', async () => {
    const { verifyWebhookChallenge } = await import(
      '../apps/wa-simulator/src/modules/webhook/webhook-verifier'
    )
    expect(typeof verifyWebhookChallenge).toBe('function')

    // Valid challenge
    const valid = verifyWebhookChallenge(
      {
        'hub.mode': 'subscribe',
        'hub.challenge': '1158201444',
        'hub.verify_token': 'test_verify_token',
      },
      'test_verify_token',
    )
    expect(valid.success).toBe(true)
    expect(valid.challenge).toBe('1158201444')

    // Invalid token -> 403
    const invalidToken = verifyWebhookChallenge(
      {
        'hub.mode': 'subscribe',
        'hub.challenge': '1158201444',
        'hub.verify_token': 'wrong_token',
      },
      'test_verify_token',
    )
    expect(invalidToken.success).toBe(false)
    expect(invalidToken.status).toBe(403)

    // Invalid mode -> 400
    const invalidMode = verifyWebhookChallenge(
      {
        'hub.mode': 'invalid_mode',
        'hub.challenge': '1158201444',
        'hub.verify_token': 'test_verify_token',
      },
      'test_verify_token',
    )
    expect(invalidMode.success).toBe(false)
    expect(invalidMode.status).toBe(400)

    // Missing challenge param -> 400
    const missingChallenge = verifyWebhookChallenge(
      {
        'hub.mode': 'subscribe',
        'hub.verify_token': 'test_verify_token',
      },
      'test_verify_token',
    )
    expect(missingChallenge.success).toBe(false)
    expect(missingChallenge.status).toBe(400)
  })

  it('should respond with challenge text when GET /webhook query params match verify token', async () => {
    const { default: app } = await import('../apps/wa-simulator/src/index')

    const res = await app.request(
      '/webhook?hub.mode=subscribe&hub.challenge=my_challenge_token_998&hub.verify_token=xatxoot_verify_token',
    )

    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('my_challenge_token_998')
  })

  it('should return 403 Forbidden when hub.verify_token does not match', async () => {
    const { default: app } = await import('../apps/wa-simulator/src/index')

    const res = await app.request(
      '/webhook?hub.mode=subscribe&hub.challenge=my_challenge_token_998&hub.verify_token=unauthorized_token',
    )

    expect(res.status).toBe(403)
  })

  it('should return 400 Bad Request when hub.mode is not subscribe or params are missing', async () => {
    const { default: app } = await import('../apps/wa-simulator/src/index')

    const resBadMode = await app.request(
      '/webhook?hub.mode=not_subscribe&hub.challenge=123&hub.verify_token=xatxoot_verify_token',
    )
    expect(resBadMode.status).toBe(400)

    const resMissingParam = await app.request(
      '/webhook?hub.mode=subscribe&hub.verify_token=xatxoot_verify_token',
    )
    expect(resMissingParam.status).toBe(400)
  })
})
