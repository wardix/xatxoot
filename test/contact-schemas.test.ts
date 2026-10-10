import { describe, expect, it } from 'bun:test'
import {
  CompanySchema,
  ContactInboxSchema,
  ContactSchema,
  ContactTypeSchema,
  CreateCompanyInputSchema,
  CreateContactInboxInputSchema,
  CreateContactInputSchema,
  UpdateContactInputSchema,
} from '../packages/shared/src/index'

describe('Contact & ContactInbox Zod Validation Schemas (Task 1.6)', () => {
  describe('ContactTypeSchema', () => {
    it('should validate allowed contact types', () => {
      expect(ContactTypeSchema.safeParse('lead').success).toBe(true)
      expect(ContactTypeSchema.safeParse('customer').success).toBe(true)
      expect(ContactTypeSchema.safeParse('partner').success).toBe(true)
      expect(ContactTypeSchema.safeParse('unknown').success).toBe(false)
    })
  })

  describe('CreateContactInputSchema', () => {
    it('should validate valid contact creation input with defaults', () => {
      const input = {
        name: 'Jane Doe',
        phoneNumber: '+6281234567890',
        email: 'jane@example.com',
      }

      const result = CreateContactInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Jane Doe')
        expect(result.data.contactType).toBe('lead')
        expect(result.data.blocked).toBe(false)
        expect(result.data.customAttributes).toEqual({})
      }
    })

    it('should reject invalid email format in contact creation', () => {
      const invalid = {
        name: 'Jane Doe',
        email: 'not-an-email',
      }

      const result = CreateContactInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate partial update for Contact', () => {
      const update = {
        name: 'Jane Updated',
        blocked: true,
        customAttributes: { vip: true, plan: 'enterprise' },
      }

      const result = UpdateContactInputSchema.safeParse(update)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.blocked).toBe(true)
      }
    })
  })

  describe('ContactSchema', () => {
    it('should validate complete Contact entity record', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        companyId: null,
        name: 'John Doe',
        phoneNumber: '+628111222333',
        email: 'john@example.com',
        avatarUrl: null,
        identifier: 'ext_cust_001',
        contactType: 'customer',
        customAttributes: { tier: 'gold' },
        additionalAttributes: {},
        blocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = ContactSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('CreateContactInboxInputSchema & ContactInboxSchema', () => {
    it('should validate valid ContactInbox creation input and apply defaults', () => {
      const input = {
        contactId: '123e4567-e89b-12d3-a456-426614174000',
        inboxId: '223e4567-e89b-12d3-a456-426614174000',
        sourceId: '+628111222333',
      }

      const result = CreateContactInboxInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.hmacVerified).toBe(false)
        expect(result.data.sourceId).toBe('+628111222333')
      }
    })

    it('should reject ContactInbox input when contactId or inboxId is not a valid UUID', () => {
      const invalid = {
        contactId: 'invalid-id',
        inboxId: '223e4567-e89b-12d3-a456-426614174000',
        sourceId: 'src_123',
      }

      const result = CreateContactInboxInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should reject ContactInbox input with empty sourceId', () => {
      const invalid = {
        contactId: '123e4567-e89b-12d3-a456-426614174000',
        inboxId: '223e4567-e89b-12d3-a456-426614174000',
        sourceId: '',
      }

      const result = CreateContactInboxInputSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    it('should validate complete ContactInbox entity record', () => {
      const entity = {
        id: '323e4567-e89b-12d3-a456-426614174000',
        contactId: '123e4567-e89b-12d3-a456-426614174000',
        inboxId: '223e4567-e89b-12d3-a456-426614174000',
        sourceId: '+628111222333',
        hmacVerified: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = ContactInboxSchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })

  describe('CompanySchema & CreateCompanyInputSchema', () => {
    it('should validate valid Company creation input', () => {
      const input = {
        name: 'Tech Solutions Ltd',
        domain: 'techsolutions.com',
        description: 'B2B Enterprise Client',
      }

      const result = CreateCompanyInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should validate complete Company entity record', () => {
      const entity = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Tech Solutions Ltd',
        domain: 'techsolutions.com',
        description: 'B2B Client',
        customAttributes: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      const result = CompanySchema.safeParse(entity)
      expect(result.success).toBe(true)
    })
  })
})
