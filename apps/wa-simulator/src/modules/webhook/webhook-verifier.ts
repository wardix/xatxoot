export interface WebhookChallengeResult {
  success: boolean
  challenge?: string
  status?: number
  error?: string
}

export function verifyWebhookChallenge(
  query: Record<string, string | undefined>,
  expectedToken: string,
): WebhookChallengeResult {
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  if (!mode || mode !== 'subscribe' || !challenge) {
    return {
      success: false,
      status: 400,
      error: 'Bad Request',
    }
  }

  if (token !== expectedToken) {
    return {
      success: false,
      status: 403,
      error: 'Forbidden',
    }
  }

  return {
    success: true,
    challenge,
  }
}
