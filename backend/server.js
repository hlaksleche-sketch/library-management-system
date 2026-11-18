import express from 'express';
import cors from 'cors';
import { randomBytes } from 'node:crypto';
import { db } from './db.js';
import { checkPassword, tokenDigest, validPassword } from './security.js';
import { fail, required } from './validation.js';
import { books } from './routes/books.js';
import { users } from './routes/users.js';
import { transactions } from './routes/transactions.js';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '16kb' }));
app.use((req, _res, next) => { req.body ??= {}; next(); });

app.post('/login', async (req, res) => {
  const membershipId = required(req.body?.membership_id, 'Membership ID', 32);
  const password = req.body.password;
  const [[user]] = await db.execute(
    'SELECT id, name, membership_id, role, password_hash FROM users WHERE membership_id = ?',
    [membershipId]
  );
  if (!user || !validPassword(password) || !(await checkPassword(password, user.password_hash))) {
    fail(401, 'Incorrect membership ID or password.');
  }
  const token = randomBytes(32).toString('hex');
  await db.execute('DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP()');
  await db.execute(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, UTC_TIMESTAMP() + INTERVAL 8 HOUR)',
    [tokenDigest(token), user.id]
  );
  const { password_hash, ...profile } = user;
  res.json({ token, user: profile });
});

async function signedIn(req, _res, next) {
  const match = /^Bearer ([0-9a-f]{64})$/.exec(req.get('Authorization') || '');
  if (!match) fail(401, 'Sign in to continue.');
  req.tokenHash = tokenDigest(match[1]);
  const [[user]] = await db.execute(
    `SELECT u.id, u.name, u.membership_id, u.role
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`, [req.tokenHash]
  );
  if (!user) fail(401, 'Your session expired. Please sign in again.');
  req.user = user;
  next();
}

function adminOnly(req, _res, next) {
  if (req.user.role !== 'admin') fail(403, 'Administrator access is required.');
  next();
}

app.get('/me', signedIn, (req, res) => res.json(req.user));
app.post('/logout', signedIn, async (req, res) => {
  await db.execute('DELETE FROM sessions WHERE token_hash = ?', [req.tokenHash]);
  res.sendStatus(204);
});
app.use('/books', signedIn, (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  return adminOnly(req, res, next);
}, books);
app.use('/users', signedIn, adminOnly, users);
app.use('/transactions', signedIn, adminOnly, transactions);
app.use((_req, res) => res.status(404).json({ message: 'Route not found.' }));

app.use((error, _req, res, _next) => {
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'That ISBN or membership ID already exists, including archived books.' });
  }
  if (error.code === 'ER_LOCK_DEADLOCK' || error.code === 'ER_LOCK_WAIT_TIMEOUT') {
    return res.status(409).json({ message: 'Another update was in progress. Please try again.' });
  }
  if (error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({ message: error.message });
  }
  console.error(error);
  res.status(500).json({ message: 'The server could not complete your request.' });
});

await db.query('SELECT 1 FROM books LIMIT 1');
const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log('Library API on http://127.0.0.1:' + port));
