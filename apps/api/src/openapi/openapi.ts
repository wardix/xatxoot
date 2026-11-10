import { OpenAPIHono, z } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import {
  CannedResponseSchema,
  ContactSchema,
  ConversationSchema,
  CreateContactInputSchema,
  CreateMessageInputSchema,
  CreateTicketInputSchema,
  CsatSurveySchema,
  InboxSchema,
  LoginInputSchema,
  MessageSchema,
  OrganizationSetupInputSchema,
  RoleSchema,
  SlashCommandSchema,
  SubmitCsatSurveyInputSchema,
  TicketPrioritySchema,
  TicketSchema,
  TicketStatusSchema,
  UserSchema,
} from '@xatxoot/shared'
import { rfc7807ErrorHandler, rfc7807NotFoundHandler } from '../middleware/rfc7807-error-handler'

export const ProblemDetailsSchema = z
  .object({
    type: z.string().openapi({ example: 'https://httpstatuses.io/400' }),
    title: z.string().openapi({ example: 'Bad Request' }),
    status: z.number().int().openapi({ example: 400 }),
    detail: z.string().openapi({ example: 'Detailed error explanation' }),
    instance: z.string().openapi({ example: '/api/v1/auth/login' }),
    invalidParams: z
      .array(
        z.object({
          name: z.string(),
          reason: z.string(),
        }),
      )
      .optional(),
    error: z.string().optional(),
  })
  .openapi('ProblemDetails')

export function registerSharedOpenApiSchemas(app: OpenAPIHono): void {
  app.openAPIRegistry.registerComponent('schemas', 'ProblemDetails', ProblemDetailsSchema)
  app.openAPIRegistry.registerComponent(
    'schemas',
    'OrganizationSetupInput',
    OrganizationSetupInputSchema,
  )
  app.openAPIRegistry.registerComponent('schemas', 'LoginInput', LoginInputSchema)
  app.openAPIRegistry.registerComponent('schemas', 'User', UserSchema)
  app.openAPIRegistry.registerComponent('schemas', 'Role', RoleSchema)
  app.openAPIRegistry.registerComponent('schemas', 'Ticket', TicketSchema)
  app.openAPIRegistry.registerComponent('schemas', 'TicketStatus', TicketStatusSchema)
  app.openAPIRegistry.registerComponent('schemas', 'TicketPriority', TicketPrioritySchema)
  app.openAPIRegistry.registerComponent('schemas', 'CreateTicketInput', CreateTicketInputSchema)
  app.openAPIRegistry.registerComponent('schemas', 'Conversation', ConversationSchema)
  app.openAPIRegistry.registerComponent('schemas', 'Message', MessageSchema)
  app.openAPIRegistry.registerComponent('schemas', 'CreateMessageInput', CreateMessageInputSchema)
  app.openAPIRegistry.registerComponent('schemas', 'Contact', ContactSchema)
  app.openAPIRegistry.registerComponent('schemas', 'CreateContactInput', CreateContactInputSchema)
  app.openAPIRegistry.registerComponent('schemas', 'Inbox', InboxSchema)
  app.openAPIRegistry.registerComponent('schemas', 'CsatSurvey', CsatSurveySchema)
  app.openAPIRegistry.registerComponent(
    'schemas',
    'SubmitCsatSurveyInput',
    SubmitCsatSurveyInputSchema,
  )
  app.openAPIRegistry.registerComponent('schemas', 'CannedResponse', CannedResponseSchema)
  app.openAPIRegistry.registerComponent('schemas', 'SlashCommand', SlashCommandSchema)
}

export function registerCoreOpenApiRoutes(app: OpenAPIHono): void {
  // Liveness Probe
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/livez',
    summary: 'Liveness Probe',
    description: 'Cek kondisi proses server internal API',
    responses: {
      200: {
        description: 'Server aktif',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string(),
              uptime: z.number(),
              timestamp: z.string(),
            }),
          },
        },
      },
    },
  })

  // Readiness Probe
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/readyz',
    summary: 'Readiness Probe',
    description: 'Cek kesiapan dependensi eksternal (PostgreSQL & Redis)',
    responses: {
      200: {
        description: 'Dependensi sehat dan siap menerima traffic',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string(),
              checks: z.record(z.string(), z.any()),
            }),
          },
        },
      },
      503: {
        description: 'Koneksi database atau redis bermasalah',
        content: {
          'application/problem+json': {
            schema: ProblemDetailsSchema,
          },
        },
      },
    },
  })

  // Prometheus Metrics
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/metrics',
    summary: 'Prometheus Metrics',
    description: 'Ekspor metrik performa aplikasi berstandar OpenMetrics',
    responses: {
      200: {
        description: 'Format metrik Prometheus teks biasa',
        content: {
          'text/plain': {
            schema: z.string(),
          },
        },
      },
    },
  })

  // Auth Setup
  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/api/v1/auth/setup',
    summary: 'Initial Instance Setup',
    description: 'Inisialisasi singleton organisasi dan akun owner pertama kali',
    request: {
      body: {
        content: {
          'application/json': {
            schema: OrganizationSetupInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Organisasi dan owner berhasil dibuat',
        content: {
          'application/json': {
            schema: z.object({
              message: z.string(),
              organization: z.any(),
              user: z.any(),
            }),
          },
        },
      },
      400: {
        description: 'Validasi gagal atau organisasi sudah diinisialisasi',
        content: {
          'application/problem+json': {
            schema: ProblemDetailsSchema,
          },
        },
      },
    },
  })

  // Auth Login
  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    summary: 'User Login',
    description: 'Autentikasi kredensial pengguna untuk mendapatkan token sesi JWT',
    request: {
      body: {
        content: {
          'application/json': {
            schema: LoginInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Login berhasil',
        content: {
          'application/json': {
            schema: z.object({
              token: z.string(),
              user: UserSchema,
            }),
          },
        },
      },
      401: {
        description: 'Kredensial tidak valid',
        content: {
          'application/problem+json': {
            schema: ProblemDetailsSchema,
          },
        },
      },
    },
  })

  // Auth Me
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    summary: 'Current User Profile',
    description: 'Mendapatkan data profil pengguna yang sedang login',
    responses: {
      200: {
        description: 'Data profil pengguna',
        content: {
          'application/json': {
            schema: z.object({
              user: UserSchema,
            }),
          },
        },
      },
      401: {
        description: 'Tidak terotentikasi',
        content: {
          'application/problem+json': {
            schema: ProblemDetailsSchema,
          },
        },
      },
    },
  })

  // Tickets
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/api/v1/tickets',
    summary: 'List Tickets',
    description: 'Mendapatkan daftar tiket pelanggan dengan filter status atau prioritas',
    responses: {
      200: {
        description: 'Daftar tiket',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(TicketSchema),
              total: z.number(),
            }),
          },
        },
      },
    },
  })

  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/api/v1/tickets',
    summary: 'Create Ticket',
    description: 'Membuat tiket baru yang terhubung ke suatu percakapan',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateTicketInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tiket berhasil dibuat',
        content: {
          'application/json': {
            schema: TicketSchema,
          },
        },
      },
    },
  })

  // Conversations
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/api/v1/conversations',
    summary: 'List Conversations',
    description: 'Mendapatkan daftar thread percakapan pelanggan dari berbagai kanal',
    responses: {
      200: {
        description: 'Daftar percakapan',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(ConversationSchema),
              total: z.number(),
            }),
          },
        },
      },
    },
  })

  // Messages
  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/api/v1/conversations/{id}/messages',
    summary: 'Send Message',
    description: 'Mengirimkan pesan agen balasan ke dalam percakapan pelanggan',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateMessageInputSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Pesan berhasil dikirim dan dicatat',
        content: {
          'application/json': {
            schema: MessageSchema,
          },
        },
      },
    },
  })

  // Contacts
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/api/v1/contacts',
    summary: 'List Contacts',
    description: 'Daftar kontak CRM omnichannel',
    responses: {
      200: {
        description: 'Daftar kontak',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(ContactSchema),
              total: z.number(),
            }),
          },
        },
      },
    },
  })

  // Inboxes
  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/api/v1/inboxes',
    summary: 'List Inboxes',
    description: 'Mendapatkan daftar kanal inbox yang terkonfigurasi',
    responses: {
      200: {
        description: 'Daftar inbox',
        content: {
          'application/json': {
            schema: z.object({
              data: z.array(InboxSchema),
              total: z.number(),
            }),
          },
        },
      },
    },
  })

  // CSAT
  app.openAPIRegistry.registerPath({
    method: 'post',
    path: '/api/v1/csat/submit',
    summary: 'Submit CSAT Survey',
    description: 'Pelanggan mengirimkan skor survei kepuasan layanan tiket',
    request: {
      body: {
        content: {
          'application/json': {
            schema: SubmitCsatSurveyInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Survei CSAT berhasil diterima',
        content: {
          'application/json': {
            schema: CsatSurveySchema,
          },
        },
      },
    },
  })

  app.openAPIRegistry.registerPath({
    method: 'get',
    path: '/api/v1/csat/metrics',
    summary: 'Get CSAT Metrics',
    description: 'Statistik agregat skor CSAT untuk analitik performa layanan',
    responses: {
      200: {
        description: 'Metrik skor CSAT',
        content: {
          'application/json': {
            schema: z.record(z.string(), z.any()),
          },
        },
      },
    },
  })
}

export function openApiApp(): OpenAPIHono {
  const app = new OpenAPIHono()

  registerSharedOpenApiSchemas(app)
  registerCoreOpenApiRoutes(app)

  // OpenAPI Specification endpoint
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'Xatxoot Customer Engagement Platform API',
      version: '1.0.0',
      description:
        'Spesifikasi resmi REST API Xatxoot untuk manajemen percakapan WhatsApp, live chat, tiket, kontak CRM, dan automasi customer service.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
  })

  // Scalar Interactive API Reference
  app.get(
    '/reference',
    apiReference({
      spec: {
        url: '/openapi.json',
      },
      pageTitle: 'Xatxoot API Reference',
    }),
  )

  // Docs route: redirect to /reference
  app.get('/docs', (c) => c.redirect('/reference', 301))

  // RFC 7807 Error handlers
  app.onError(rfc7807ErrorHandler)
  app.notFound(rfc7807NotFoundHandler)

  return app
}
