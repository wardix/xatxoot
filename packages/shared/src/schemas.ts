import { z } from 'zod'

export const OrganizationSetupInputSchema = z.object({
  organizationName: z.string().min(1, 'Nama organisasi wajib diisi'),
  adminName: z.string().min(1, 'Nama admin wajib diisi'),
  adminEmail: z.string().email('Format email tidak valid'),
  adminPassword: z.string().min(8, 'Password minimal 8 karakter'),
  timezone: z.string().default('UTC'),
  defaultLocale: z.string().default('en'),
})
export type OrganizationSetupInput = z.infer<typeof OrganizationSetupInputSchema>

export const LoginInputSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const RoleSchema = z.enum(['owner', 'administrator', 'agent'])
export type Role = z.infer<typeof RoleSchema>

export const UserAvailabilitySchema = z.enum(['online', 'offline', 'busy'])
export type UserAvailability = z.infer<typeof UserAvailabilitySchema>

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: RoleSchema,
  customRoleId: z.string().uuid().nullable().optional(),
  availability: UserAvailabilitySchema.default('online'),
  avatarUrl: z.string().url().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: z.string().or(z.date()),
})
export type User = z.infer<typeof UserSchema>

export const UserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: RoleSchema,
})
export type UserRole = z.infer<typeof UserRoleSchema>

export const AuthTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().positive(),
  tokenType: z.literal('Bearer').default('Bearer'),
})
export type AuthTokens = z.infer<typeof AuthTokensSchema>

export const AuthSessionSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
})
export type AuthSession = z.infer<typeof AuthSessionSchema>

// ==========================================
// Phase 1: Channel & Inbox Configuration
// ==========================================

export const ChannelTypeSchema = z.enum([
  'whatsapp_cloud',
  'whatsapp_unofficial',
  'web_widget',
  'api',
])
export type ChannelType = z.infer<typeof ChannelTypeSchema>

export const SenderNameTypeSchema = z.enum(['friendly', 'professional'])
export type SenderNameType = z.infer<typeof SenderNameTypeSchema>

export const WhatsAppUnofficialConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
  'connecting',
  'qr_ready',
])
export type WhatsAppUnofficialConnectionStatus = z.infer<
  typeof WhatsAppUnofficialConnectionStatusSchema
>

export const WebWidgetReplyTimeSchema = z.enum(['in_a_few_minutes', 'in_a_few_hours', 'in_a_day'])
export type WebWidgetReplyTime = z.infer<typeof WebWidgetReplyTimeSchema>

// 1. WhatsApp Cloud Channel Schemas
export const CreateWhatsAppCloudChannelInputSchema = z.object({
  phoneNumber: z.string().min(1, 'Nomor telepon wajib diisi'),
  phoneNumberId: z.string().min(1, 'Phone Number ID wajib diisi'),
  wabaId: z.string().min(1, 'WABA ID wajib diisi'),
  accessToken: z.string().min(1, 'Access token wajib diisi'),
  webhookVerifyToken: z.string().min(1, 'Webhook verify token wajib diisi'),
})
export type CreateWhatsAppCloudChannelInput = z.infer<typeof CreateWhatsAppCloudChannelInputSchema>

export const WhatsAppCloudChannelSchema = z.object({
  id: z.string().uuid(),
  phoneNumber: z.string(),
  phoneNumberId: z.string(),
  wabaId: z.string(),
  accessToken: z.string(),
  webhookVerifyToken: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WhatsAppCloudChannel = z.infer<typeof WhatsAppCloudChannelSchema>

// 2. WhatsApp Unofficial Channel Schemas
export const CreateWhatsAppUnofficialChannelInputSchema = z.object({
  sessionId: z.string().min(1, 'Session ID wajib diisi'),
  phoneNumber: z.string().nullable().optional(),
  connectionStatus: WhatsAppUnofficialConnectionStatusSchema.default('disconnected'),
  qrCode: z.string().nullable().optional(),
})
export type CreateWhatsAppUnofficialChannelInput = z.infer<
  typeof CreateWhatsAppUnofficialChannelInputSchema
>

export const WhatsAppUnofficialChannelSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string(),
  phoneNumber: z.string().nullable().optional(),
  connectionStatus: WhatsAppUnofficialConnectionStatusSchema,
  qrCode: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WhatsAppUnofficialChannel = z.infer<typeof WhatsAppUnofficialChannelSchema>

// 3. Web Widget Channel Schemas
export const CreateWebWidgetChannelInputSchema = z.object({
  websiteToken: z.string().optional(),
  websiteUrl: z.string().url().nullable().optional().or(z.literal('')),
  allowedDomains: z.array(z.string()).default([]),
  widgetColor: z.string().default('#10b981'),
  replyTime: WebWidgetReplyTimeSchema.default('in_a_few_minutes'),
  preChatFormEnabled: z.boolean().default(false),
  hmacSecret: z.string().nullable().optional(),
})
export type CreateWebWidgetChannelInput = z.infer<typeof CreateWebWidgetChannelInputSchema>

export const WebWidgetChannelSchema = z.object({
  id: z.string().uuid(),
  websiteToken: z.string(),
  websiteUrl: z.string().nullable().optional(),
  allowedDomains: z.array(z.string()),
  widgetColor: z.string(),
  replyTime: WebWidgetReplyTimeSchema,
  preChatFormEnabled: z.boolean(),
  hmacSecret: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type WebWidgetChannel = z.infer<typeof WebWidgetChannelSchema>

// 4. API Channel Schemas
export const CreateApiChannelInputSchema = z.object({
  name: z.string().min(1, 'Nama API channel wajib diisi'),
  webhookUrl: z.string().url().nullable().optional().or(z.literal('')),
  apiKeyHash: z.string().optional(),
  authToken: z.string().nullable().optional(),
})
export type CreateApiChannelInput = z.infer<typeof CreateApiChannelInputSchema>

export const ApiChannelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  webhookUrl: z.string().nullable().optional(),
  apiKeyHash: z.string(),
  authToken: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type ApiChannel = z.infer<typeof ApiChannelSchema>

// 5. Inbox Schemas
export const CreateInboxInputSchema = z.object({
  name: z.string().min(1, 'Nama inbox wajib diisi'),
  channelType: ChannelTypeSchema,
  channelId: z.string().uuid('Channel ID harus berupa UUID valid'),
  enableAutoAssign: z.boolean().default(true),
  greetingEnabled: z.boolean().default(false),
  greetingMessage: z.string().nullable().optional(),
  workingHoursEnabled: z.boolean().default(false),
  workingHours: z.record(z.any()).default({}),
  outOfOfficeMessage: z.string().nullable().optional(),
  lockToSingleConv: z.boolean().default(false),
  senderNameType: SenderNameTypeSchema.default('friendly'),
})
export type CreateInboxInput = z.infer<typeof CreateInboxInputSchema>

export const UpdateInboxInputSchema = CreateInboxInputSchema.partial()
export type UpdateInboxInput = z.infer<typeof UpdateInboxInputSchema>

export const InboxSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  channelType: ChannelTypeSchema,
  channelId: z.string().uuid(),
  enableAutoAssign: z.boolean(),
  greetingEnabled: z.boolean(),
  greetingMessage: z.string().nullable().optional(),
  workingHoursEnabled: z.boolean(),
  workingHours: z.record(z.any()),
  outOfOfficeMessage: z.string().nullable().optional(),
  lockToSingleConv: z.boolean(),
  senderNameType: SenderNameTypeSchema,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Inbox = z.infer<typeof InboxSchema>

// 6. Inbox Member Schemas
export const InboxMemberSchema = z.object({
  inboxId: z.string().uuid(),
  userId: z.string().uuid(),
})
export type InboxMember = z.infer<typeof InboxMemberSchema>

export const AddInboxMemberInputSchema = InboxMemberSchema
export type AddInboxMemberInput = z.infer<typeof AddInboxMemberInputSchema>

// ==========================================
// Phase 1: Contact, ContactInbox & Company
// ==========================================

export const ContactTypeSchema = z.enum(['lead', 'customer', 'partner'])
export type ContactType = z.infer<typeof ContactTypeSchema>

// 1. Company Schemas
export const CreateCompanyInputSchema = z.object({
  name: z.string().min(1, 'Nama perusahaan wajib diisi'),
  domain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  customAttributes: z.record(z.any()).default({}),
})
export type CreateCompanyInput = z.infer<typeof CreateCompanyInputSchema>

export const UpdateCompanyInputSchema = CreateCompanyInputSchema.partial()
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInputSchema>

export const CompanySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domain: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  customAttributes: z.record(z.any()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Company = z.infer<typeof CompanySchema>

// 2. Contact Schemas
export const CreateContactInputSchema = z.object({
  companyId: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  email: z.string().email('Format email tidak valid').nullable().optional().or(z.literal('')),
  avatarUrl: z.string().url().nullable().optional().or(z.literal('')),
  identifier: z.string().nullable().optional(),
  contactType: ContactTypeSchema.default('lead'),
  customAttributes: z.record(z.any()).default({}),
  additionalAttributes: z.record(z.any()).default({}),
  blocked: z.boolean().default(false),
})
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>

export const UpdateContactInputSchema = CreateContactInputSchema.partial()
export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>

export const ContactSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid().nullable().optional(),
  name: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  identifier: z.string().nullable().optional(),
  contactType: ContactTypeSchema,
  customAttributes: z.record(z.any()),
  additionalAttributes: z.record(z.any()),
  blocked: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Contact = z.infer<typeof ContactSchema>

// 3. ContactInbox Schemas
export const CreateContactInboxInputSchema = z.object({
  contactId: z.string().uuid('Contact ID harus berupa UUID valid'),
  inboxId: z.string().uuid('Inbox ID harus berupa UUID valid'),
  sourceId: z.string().min(1, 'Source ID wajib diisi'),
  hmacVerified: z.boolean().default(false),
})
export type CreateContactInboxInput = z.infer<typeof CreateContactInboxInputSchema>

export const ContactInboxSchema = z.object({
  id: z.string().uuid(),
  contactId: z.string().uuid(),
  inboxId: z.string().uuid(),
  sourceId: z.string(),
  hmacVerified: z.boolean(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type ContactInbox = z.infer<typeof ContactInboxSchema>

// ==========================================
// Phase 1: Ticket Lifecycle & Transitions
// ==========================================

export const TicketStatusSchema = z.enum(['open', 'pending', 'snoozed', 'resolved'])
export type TicketStatus = z.infer<typeof TicketStatusSchema>

export const TicketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
export type TicketPriority = z.infer<typeof TicketPrioritySchema>

export function isValidTicketTransition(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return false
  const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
    open: ['pending', 'snoozed', 'resolved'],
    pending: ['open', 'resolved'],
    snoozed: ['open', 'resolved'],
    resolved: ['open'],
  }
  return allowedTransitions[from]?.includes(to) ?? false
}

export const CreateTicketInputSchema = z.object({
  conversationId: z.string().uuid('Conversation ID harus berupa UUID valid'),
  status: TicketStatusSchema.default('open'),
  priority: TicketPrioritySchema.default('medium'),
  assigneeId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  internalNote: z.string().nullable().optional(),
  snoozedUntil: z.string().or(z.date()).nullable().optional(),
  deadlineAt: z.string().or(z.date()).nullable().optional(),
  customAttributes: z.record(z.any()).default({}),
})
export type CreateTicketInput = z.infer<typeof CreateTicketInputSchema>

export const UpdateTicketStatusInputSchema = z.object({
  status: TicketStatusSchema,
  snoozedUntil: z.string().or(z.date()).nullable().optional(),
})
export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusInputSchema>

export const UpdateTicketInternalNoteInputSchema = z.object({
  internalNote: z.string(),
})
export type UpdateTicketInternalNoteInput = z.infer<typeof UpdateTicketInternalNoteInputSchema>

export const TicketSchema = z.object({
  id: z.string().uuid(),
  displayId: z.number().int().or(z.string()),
  conversationId: z.string().uuid(),
  assigneeId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  status: TicketStatusSchema,
  priority: TicketPrioritySchema,
  snoozedUntil: z.string().or(z.date()).nullable().optional(),
  waitingSince: z.string().or(z.date()).nullable().optional(),
  deadlineAt: z.string().or(z.date()).nullable().optional(),
  firstReplyCreatedAt: z.string().or(z.date()).nullable().optional(),
  openedAt: z.string().or(z.date()),
  resolvedAt: z.string().or(z.date()).nullable().optional(),
  internalNote: z.string().nullable().optional(),
  internalNoteUpdatedBy: z.string().uuid().nullable().optional(),
  internalNoteUpdatedAt: z.string().or(z.date()).nullable().optional(),
  customAttributes: z.record(z.any()),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Ticket = z.infer<typeof TicketSchema>

// ==========================================
// Phase 1: Message Payload & Communications
// ==========================================

export const MessageSenderTypeSchema = z.enum(['user', 'contact', 'bot', 'system'])
export type MessageSenderType = z.infer<typeof MessageSenderTypeSchema>

export const MessageTypeSchema = z.enum(['incoming', 'outgoing', 'activity', 'template'])
export type MessageType = z.infer<typeof MessageTypeSchema>

export const MessageContentTypeSchema = z.enum([
  'text',
  'image',
  'video',
  'audio',
  'file',
  'location',
  'interactive',
])
export type MessageContentType = z.infer<typeof MessageContentTypeSchema>

export const MessageStatusSchema = z.enum(['sent', 'delivered', 'read', 'failed'])
export type MessageStatus = z.infer<typeof MessageStatusSchema>

export const AttachmentInputSchema = z.object({
  fileType: z.string().min(1, 'File type wajib diisi'),
  fileUrl: z.string().url('File URL harus berupa URL valid'),
  thumbUrl: z.string().url().nullable().optional(),
  fileSize: z.number().nonnegative().default(0),
  fileName: z.string().nullable().optional(),
  metadata: z.record(z.any()).default({}),
})
export type AttachmentInput = z.infer<typeof AttachmentInputSchema>

export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  fileType: z.string(),
  fileUrl: z.string(),
  thumbUrl: z.string().nullable().optional(),
  fileSize: z.number().nonnegative(),
  fileName: z.string().nullable().optional(),
  metadata: z.record(z.any()),
  createdAt: z.string().or(z.date()),
})
export type Attachment = z.infer<typeof AttachmentSchema>

export const CreateMessageInputSchema = z.object({
  conversationId: z.string().uuid('Conversation ID harus berupa UUID valid'),
  ticketId: z.string().uuid().nullable().optional(),
  senderType: MessageSenderTypeSchema,
  senderId: z.string().uuid().nullable().optional(),
  messageType: MessageTypeSchema.default('incoming'),
  content: z.string().nullable().optional(),
  contentType: MessageContentTypeSchema.default('text'),
  status: MessageStatusSchema.default('sent'),
  externalSourceId: z.string().nullable().optional(),
  contentAttributes: z.record(z.any()).default({}),
  attachments: z.array(AttachmentInputSchema).default([]),
})
export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  ticketId: z.string().uuid().nullable().optional(),
  senderType: MessageSenderTypeSchema,
  senderId: z.string().uuid().nullable().optional(),
  messageType: MessageTypeSchema,
  content: z.string().nullable().optional(),
  contentType: MessageContentTypeSchema,
  status: MessageStatusSchema,
  externalSourceId: z.string().nullable().optional(),
  contentAttributes: z.record(z.any()),
  attachments: z.array(AttachmentSchema).optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
})
export type Message = z.infer<typeof MessageSchema>
