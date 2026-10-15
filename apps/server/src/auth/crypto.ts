import { createHash, createHmac, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
export const hashValue = (value: string) => createHash('sha256').update(value).digest('hex');
export const hmac = (key: Buffer, value: string) =>
  createHmac('sha256', key).update(value).digest('hex');
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  return !!salt && !!hash && equal(scryptSync(password, salt, 64).toString('hex'), hash);
}
