import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function tokenMatches(token: unknown, hash: string): boolean {
  return (
    typeof token === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(token) &&
    /^[a-f0-9]{64}$/.test(hash) &&
    timingSafeEqual(
      Buffer.from(hashToken(token), 'hex'),
      Buffer.from(hash, 'hex'),
    )
  );
}
