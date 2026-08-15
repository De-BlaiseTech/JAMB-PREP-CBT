const crypto = require('crypto');

function getKey() {
  const raw = String(process.env.REGISTRATION_ENCRYPTION_KEY || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('Server configuration is incomplete.');
  }
  return Buffer.from(raw, 'hex');
}

function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decrypt(payload) {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid registration data.');
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function emailId(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = { encrypt, decrypt, emailId, tokenHash };
