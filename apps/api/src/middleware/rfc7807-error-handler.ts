import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  invalidParams?: Array<{ name: string; reason: string }>
  issues?: unknown[]
  error?: string
  [key: string]: unknown
}

export const HTTP_STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

export class HttpProblemException extends Error {
  public readonly status: number
  public readonly title: string
  public readonly detail: string
  public readonly type: string
  public readonly invalidParams?: Array<{ name: string; reason: string }>
  public readonly extra?: Record<string, unknown>

  constructor(options: {
    status: number
    title?: string
    detail?: string
    type?: string
    instance?: string
    invalidParams?: Array<{ name: string; reason: string }>
    extra?: Record<string, unknown>
  }) {
    super(options.detail || options.title || 'HTTP Problem')
    this.name = 'HttpProblemException'
    this.status = options.status
    this.title = options.title || HTTP_STATUS_TITLES[options.status] || 'HTTP Error'
    this.detail = options.detail || this.title
    this.type = options.type || `https://httpstatuses.io/${options.status}`
    this.invalidParams = options.invalidParams
    this.extra = options.extra
  }
}

export function createProblemDetails(err: unknown, instancePath: string): ProblemDetails {
  if (err instanceof HttpProblemException) {
    return {
      type: err.type,
      title: err.title,
      status: err.status,
      detail: err.detail,
      instance: instancePath,
      invalidParams: err.invalidParams,
      error: err.detail || err.title,
      ...(err.extra || {}),
    }
  }

  if (err instanceof HTTPException) {
    const status = err.status
    const title = HTTP_STATUS_TITLES[status] || 'HTTP Error'
    const detail = err.message || title
    return {
      type: `https://httpstatuses.io/${status}`,
      title,
      status,
      detail,
      instance: instancePath,
      error: detail,
    }
  }

  if (err instanceof Error) {
    const isClientError =
      'status' in err && typeof (err as { status?: unknown }).status === 'number'
    const status = isClientError ? (err as { status: number }).status : 500
    const title = HTTP_STATUS_TITLES[status] || 'Internal Server Error'
    const detail = err.message || title

    return {
      type: `https://httpstatuses.io/${status}`,
      title,
      status,
      detail,
      instance: instancePath,
      error: detail,
    }
  }

  return {
    type: 'https://httpstatuses.io/500',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
    instance: instancePath,
    error: 'Internal Server Error',
  }
}

export const rfc7807ErrorHandler: ErrorHandler = (err: Error, c: Context) => {
  const instance = c.req.path
  const problem = createProblemDetails(err, instance)
  const status = (problem.status || 500) as
    | 400
    | 401
    | 403
    | 404
    | 409
    | 422
    | 429
    | 500
    | 502
    | 503
    | 504

  return c.json(problem, status, {
    'Content-Type': 'application/problem+json; charset=utf-8',
  })
}

export const rfc7807NotFoundHandler: NotFoundHandler = (c: Context) => {
  const instance = c.req.path
  const problem: ProblemDetails = {
    type: 'https://httpstatuses.io/404',
    title: 'Not Found',
    status: 404,
    detail: `Route ${c.req.method} ${instance} not found`,
    instance,
    error: `Route ${c.req.method} ${instance} not found`,
  }

  return c.json(problem, 404, {
    'Content-Type': 'application/problem+json; charset=utf-8',
  })
}
