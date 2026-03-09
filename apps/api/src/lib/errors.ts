import { err } from 'neverthrow'

export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class ExternalApiError extends AppError {
  constructor(provider: string, message: string) {
    super('EXTERNAL_API_ERROR', `${provider}: ${message}`, 502)
  }
}

export class RateLimitedError extends AppError {
  constructor(provider: string) {
    super('RATE_LIMITED', `${provider} rate limit exceeded`, 429)
  }
}

export class QuotaExceededError extends AppError {
  constructor(message = 'Monthly quota exceeded') {
    super('QUOTA_EXCEEDED', message, 429)
  }
}

export class EnrichmentFailedError extends AppError {
  constructor(leadId: string) {
    super('ENRICHMENT_FAILED', `All enrichment providers failed for lead ${leadId}`, 422)
  }
}

export class CrmSyncFailedError extends AppError {
  constructor(message: string) {
    super('CRM_SYNC_FAILED', message, 502)
  }
}

// Convenience: wrap unknown thrown errors into AppError
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  if (e instanceof Error) return new AppError('INTERNAL_ERROR', e.message)
  return new AppError('INTERNAL_ERROR', 'Unknown error')
}

// Convenience: create an err() result from unknown
export function errFrom(e: unknown) {
  return err(toAppError(e))
}
