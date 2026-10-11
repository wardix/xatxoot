import { type ConnectionOptions, Worker } from 'bullmq'
import {
  BULLMQ_QUEUE_WA_OUTBOUND,
  JOB_NAME_SEND_MESSAGE,
  JOB_NAME_SEND_REACTION,
  type SendWaMessageJobPayload,
  type SendWaReactionJobPayload,
} from '../types/queue'
import type { OutboundMessageDispatcher } from './outbound-dispatcher'

export interface OutboundJob {
  name: string
  data: unknown
}

export async function processOutboundJob(
  job: OutboundJob,
  dispatcher: OutboundMessageDispatcher,
): Promise<{ success: boolean; externalMessageId: string }> {
  if (job.name === JOB_NAME_SEND_MESSAGE) {
    return dispatcher.sendMessage(job.data as SendWaMessageJobPayload)
  }

  if (job.name === JOB_NAME_SEND_REACTION) {
    return dispatcher.sendReaction(job.data as SendWaReactionJobPayload)
  }

  throw new Error(`Unknown job name: ${job.name}`)
}

export interface CreateWorkerOptions {
  connection?: ConnectionOptions
  dispatcher: OutboundMessageDispatcher
  concurrency?: number
}

export function createOutboundWorker(options: CreateWorkerOptions): Worker {
  const connection = options.connection || {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  }

  return new Worker(
    BULLMQ_QUEUE_WA_OUTBOUND,
    async (job) => processOutboundJob(job, options.dispatcher),
    {
      connection,
      concurrency: options.concurrency ?? 5,
    },
  )
}
