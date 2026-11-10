import { describe, expect, it } from 'bun:test'
import app from './index'
import {
  HttpProblemException,
  createProblemDetails,
  rfc7807ErrorHandler,
} from './middleware/rfc7807-error-handler'
import { openApiApp } from './openapi/openapi'

describe('OpenAPI/Swagger Specification & RFC 7807 Error Standardization (Issue #323)', () => {
  describe('1. OpenAPI Specification (/openapi.json)', () => {
    it('should serve OpenAPI specification at /openapi.json with 200 OK', async () => {
      const res = await app.request('/openapi.json')
      expect(res.status).toBe(200)

      const doc = await res.json()
      expect(doc.openapi).toBeDefined()
      expect(doc.info).toBeDefined()
      expect(doc.info.title).toContain('Xatxoot')
      expect(doc.info.version).toBeDefined()
    })

    it('should register shared Zod schemas from @xatxoot/shared in components.schemas', async () => {
      const res = await app.request('/openapi.json')
      expect(res.status).toBe(200)

      const doc = await res.json()
      expect(doc.components).toBeDefined()
      expect(doc.components.schemas).toBeDefined()

      const schemas = doc.components.schemas
      // Verify key domain schemas are connected
      expect(schemas.OrganizationSetupInput).toBeDefined()
      expect(schemas.LoginInput).toBeDefined()
      expect(schemas.TicketStatus).toBeDefined()
      expect(schemas.TicketPriority).toBeDefined()
      expect(schemas.ProblemDetails).toBeDefined()
    })

    it('should document key API paths in openapi spec', async () => {
      const res = await app.request('/openapi.json')
      const doc = await res.json()

      expect(doc.paths).toBeDefined()
      expect(doc.paths['/livez'] || doc.paths['/health']).toBeDefined()
      expect(doc.paths['/api/v1/auth/login']).toBeDefined()
      expect(doc.paths['/api/v1/auth/setup']).toBeDefined()
      expect(doc.paths['/api/v1/tickets']).toBeDefined()
      expect(doc.paths['/api/v1/conversations']).toBeDefined()
    })

    it('should strictly NOT expose account_id or accountId in schemas per Single Organization rule', async () => {
      const res = await app.request('/openapi.json')
      const text = await res.text()

      expect(text).not.toContain('account_id')
      expect(text).not.toContain('accountId')
    })
  })

  describe('2. Interactive API Documentation (/reference & /docs)', () => {
    it('should serve interactive Scalar documentation at /reference', async () => {
      const res = await app.request('/reference')
      expect(res.status).toBe(200)
      const contentType = res.headers.get('content-type') || ''
      expect(contentType).toContain('text/html')

      const body = await res.text()
      expect(body.toLowerCase()).toContain('scalar')
    })

    it('should support /docs route redirecting or serving API reference', async () => {
      const res = await app.request('/docs')
      // Either 200 with HTML or 301/302/308 redirect to /reference
      expect([200, 301, 302, 307, 308]).toContain(res.status)
      if (res.status === 200) {
        const contentType = res.headers.get('content-type') || ''
        expect(contentType).toContain('text/html')
      } else {
        expect(res.headers.get('location')).toBe('/reference')
      }
    })
  })

  describe('3. RFC 7807 Error Standardization', () => {
    it('should format HttpProblemException into RFC 7807 problem details', () => {
      const problem = new HttpProblemException({
        status: 400,
        title: 'Bad Request',
        detail: 'Format email tidak valid',
        instance: '/api/v1/auth/login',
        invalidParams: [{ name: 'email', reason: 'Format email tidak valid' }],
      })

      const details = createProblemDetails(problem, '/api/v1/auth/login')
      expect(details.status).toBe(400)
      expect(details.title).toBe('Bad Request')
      expect(details.detail).toBe('Format email tidak valid')
      expect(details.instance).toBe('/api/v1/auth/login')
      expect(details.type).toBeDefined()
      expect(details.invalidParams).toHaveLength(1)
    })

    it('should return application/problem+json on 404 Not Found via app', async () => {
      const res = await app.request('/api/v1/non-existent-endpoint-xyz')
      expect(res.status).toBe(404)
      const contentType = res.headers.get('content-type') || ''
      expect(contentType).toContain('problem+json')

      const body = await res.json()
      expect(body.type).toBeDefined()
      expect(body.title).toBe('Not Found')
      expect(body.status).toBe(404)
      expect(body.detail).toBeDefined()
      expect(body.instance).toBe('/api/v1/non-existent-endpoint-xyz')
    })

    it('should handle unhandled exceptions through app.onError with RFC 7807 format', async () => {
      // Create a test route that throws an unhandled error
      const testApp = openApiApp()
      testApp.get('/test-unhandled-error', () => {
        throw new Error('Database connection failed unexpectedly')
      })

      const res = await testApp.request('/test-unhandled-error')
      expect(res.status).toBe(500)
      const contentType = res.headers.get('content-type') || ''
      expect(contentType).toContain('problem+json')

      const body = await res.json()
      expect(body.type).toBeDefined()
      expect(body.title).toBe('Internal Server Error')
      expect(body.status).toBe(500)
      expect(body.detail).toBe('Database connection failed unexpectedly')
      expect(body.instance).toBe('/test-unhandled-error')
    })
  })
})
