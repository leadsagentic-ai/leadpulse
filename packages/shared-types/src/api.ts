import { z } from 'zod'

export const ErrorCodeEnum = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'ENRICHMENT_FAILED',
  'CRM_SYNC_FAILED',
  'EXTERNAL_API_ERROR',
  'INTERNAL_ERROR',
])

export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        page: z.number().int().optional(),
        limit: z.number().int().optional(),
        total: z.number().int().optional(),
        hasMore: z.boolean().optional(),
      })
      .optional(),
  })

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: ErrorCodeEnum,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ErrorCode = z.infer<typeof ErrorCodeEnum>
export type ApiError = z.infer<typeof ApiErrorSchema>
export type ApiSuccess<T> = { success: true; data: T; meta?: { page?: number; limit?: number; total?: number; hasMore?: boolean } }
export type ApiResponse<T> = ApiSuccess<T> | ApiError

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof PaginationSchema>
