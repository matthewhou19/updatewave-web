import { randomBytes } from 'node:crypto'

/**
 * Generate a fresh URL-safe identity hash for a brand-new user.
 *
 * 16 random bytes encoded as 32 hex chars. Hex is URL-safe (no
 * percent-encoding needed) and the `users.hash` column has a UNIQUE
 * constraint that catches the astronomically unlikely collision.
 *
 * Used by /auth/callback case 4 (brand-new user) when no existing
 * users row matches the magic-link email.
 */
export function generateUserHash(): string {
  return randomBytes(16).toString('hex')
}
