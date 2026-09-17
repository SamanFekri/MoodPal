// Encrypt / decrypt small secrets (e.g. users' own OpenAI keys) before storing them in MongoDB.
// AES-256-GCM with a key derived from KEY_ENCRYPTION_SECRET (falls back to BOT_TOKEN).
require('dotenv').config();
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey() {
  const secret = process.env.KEY_ENCRYPTION_SECRET || process.env.BOT_TOKEN;
  if (!secret) {
    throw new Error('Missing KEY_ENCRYPTION_SECRET (or BOT_TOKEN) for encrypting secrets');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

// Returns "iv.tag.ciphertext" (base64url) so it can be stored as a plain string
function encrypt(plainText) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(b => b.toString('base64url')).join('.');
}

function decrypt(payload) {
  if (!payload) return null;
  const [iv, tag, encrypted] = payload.split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
