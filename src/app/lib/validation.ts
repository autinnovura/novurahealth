import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * Result of attempting to validate an API request body against a Zod schema.
 * On success, callers can safely use `result.data` (fully typed).
 * On failure, callers should immediately `return result.response` — a 400
 * NextResponse with structured field-level errors.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse }

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * Usage:
 *   const result = await validateRequestBody(req, mySchema)
 *   if (!result.success) return result.response
 *   const { foo } = result.data   // typed!
 *
 * Returns a 400 with `{ error, message, issues[] }` if the body is invalid
 * JSON or doesn't match the schema. The shape mirrors the existing error
 * envelope used elsewhere in the API ({ error, message }).
 */
export async function validateRequestBody<T>(
  req: NextRequest,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Invalid JSON',
          message: 'Request body could not be parsed as JSON.',
        },
        { status: 400 }
      ),
    }
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: 'Validation failed',
          message: 'Request body did not match the expected shape.',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.') || '(root)',
            message: i.message,
          })),
        },
        { status: 400 }
      ),
    }
  }

  return { success: true, data: parsed.data }
}
