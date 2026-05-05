import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'

/**
 * App-layer encryption for sensitive health data.
 * Uses AES-256-GCM (authenticated encryption) with a per-record random IV.
 *
 * Encrypted values are stored as: iv:authTag:ciphertext (all hex-encoded)
 * This format is safe for text columns in Postgres.
 *
 * Requires DATA_ENCRYPTION_KEY env var — a 64-char hex string (32 bytes).
 * Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.DATA_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error(
      'DATA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypt a plaintext string. Returns a colon-delimited string: iv:authTag:ciphertext
 * Returns null if input is null/undefined (pass-through for optional fields).
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null

  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypt a value produced by encrypt(). Returns the original plaintext.
 * Returns null if input is null/undefined.
 * Returns the original string unchanged if it doesn't look encrypted (migration-safe).
 */
export function decrypt(encryptedValue: string | null | undefined): string | null {
  if (encryptedValue == null) return null

  // Check if value looks encrypted (hex:hex:hex format)
  const parts = encryptedValue.split(':')
  if (parts.length !== 3) {
    // Not encrypted — return as-is (supports reading old unencrypted data during migration)
    return encryptedValue
  }

  const [ivHex, authTagHex, ciphertext] = parts

  // Additional validation: IV should be 24 hex chars (12 bytes), authTag 32 hex chars (16 bytes)
  if (ivHex.length !== 24 || authTagHex.length !== 32) {
    return encryptedValue // Not our format — return as-is
  }

  try {
    const key = getKey()
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch {
    // Decryption failed — could be old unencrypted data that happened to have colons
    return encryptedValue
  }
}

/**
 * Encrypt multiple fields on an object. Returns a new object with specified fields encrypted.
 * Non-existent or null fields are skipped.
 */
export function encryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[field as string] = encrypt(value)
    }
  }
  return result
}

/**
 * Decrypt multiple fields on an object. Returns a new object with specified fields decrypted.
 * Non-existent or null fields are skipped.
 */
export function decryptFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string') {
      (result as Record<string, unknown>)[field as string] = decrypt(value)
    }
  }
  return result
}
