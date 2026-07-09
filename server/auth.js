// Commander accounts: name + PIN, scrypt-hashed, bearer-token sessions.
import crypto from 'node:crypto';

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(pin, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

export function validCredentials(name, pin) {
  if (typeof name !== 'string' || typeof pin !== 'string') return 'Name and PIN required';
  const n = name.trim();
  if (n.length < 2 || n.length > 16) return 'Name must be 2-16 characters';
  if (!/^[A-Za-z0-9 _-]+$/.test(n)) return 'Name: letters, numbers, spaces, - and _ only';
  if (pin.length < 4 || pin.length > 64) return 'PIN must be at least 4 characters';
  return null;
}

// Express middleware: resolves Authorization: Bearer <token> to req.player.
export function requireAuth(storage) {
  return async (req, res, next) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Not signed in' });
    const session = await storage.getSession(token);
    if (!session) return res.status(401).json({ error: 'Session expired' });
    req.player = session;
    req.token = token;
    next();
  };
}
