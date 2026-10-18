import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hashes a plaintext password using bcrypt with a generated salt.
 * @param plain The plaintext password string to hash.
 * @returns The resulting bcrypt hash string.
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain) {
    throw new Error("Password cannot be empty");
  }
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * Safely returns false if the hash is malformed, corrupted, or does not match.
 * @param plain The candidate plaintext password.
 * @param hash The stored bcrypt hash string.
 * @returns True if password matches hash, false otherwise.
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (!plain || !hash) {
    return false;
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
