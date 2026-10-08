import { AppError } from '../errors/app-error.js';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const cost = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
let inFlight = 0;
async function derive(password: string, salt: Buffer): Promise<Buffer> {
  if (inFlight >= 2)
    throw new AppError(
      503,
      'AUTH_BUSY',
      'Authentication capacity temporarily unavailable',
    );
  inFlight++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(password, salt, 64, cost, (error, key) =>
        error ? reject(error) : resolve(key),
      ),
    );
  } finally {
    inFlight--;
  }
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `scrypt$131072$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export async function verifyPassword(
  password: string,
  encoded: string | null,
): Promise<boolean> {
  const match = encoded?.match(
    /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/,
  );
  const salt = match?.[1] ? Buffer.from(match[1], 'hex') : Buffer.alloc(16);
  const expected = match?.[2] ? Buffer.from(match[2], 'hex') : Buffer.alloc(64);
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected) && Boolean(match);
}
