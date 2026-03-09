import { z } from 'zod'

export const ErrorCodeEnum = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'EXTERNAL_API_ERROR',
  'ENRICHMENT_FAILED',
  'CRM_SYNC_FAILED',
  'INTERNAL_ERROR',
])

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code:    ErrorCodeEnum,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export const PaginationMetaSchema = z.object({
  total:   z.number().int().nonnegative(),
  page:    z.number().int().positive(),
  limit:   z.number().int().positive(),
  hasMore: z.boolean(),
})

export function ApiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data:    dataSchema,
    meta:    PaginationMetaSchema.optional(),
  })
}

export type ErrorCode      = z.infer<typeof ErrorCodeEnum>
export type ApiError       = z.infer<typeof ApiErrorSchema>
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>
export type ApiSuccess<T>  = { success: true; data: T; meta?: PaginationMeta }
export type ApiResponse<T> = ApiSuccess<T> | ApiError
