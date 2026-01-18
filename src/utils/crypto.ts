import crypto from 'crypto';

/**
 * Hash a token using SHA-256.
 * Store the hash (not the raw token) in persistent storage.
 */
export const sha256 = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

export default { sha256 };

