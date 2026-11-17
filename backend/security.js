import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const tokenDigest = (token) => createHash('sha256').update(token).digest('hex');
export const validPassword = (password) =>
  typeof password === 'string' && password.length >= 8 && password.length <= 128;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return salt + ':' + key.toString('hex');
}

export async function checkPassword(password, storedHash) {
  const [salt, key] = storedHash.split(':');
  return timingSafeEqual(await derive(password, salt, 64), Buffer.from(key, 'hex'));
}
