import { Router } from 'express';
import { db } from '../db.js';
import { hashPassword, validPassword } from '../security.js';
import { choice, fail, one, required } from '../validation.js';

export const users = Router();
const visibleFields = 'id, name, membership_id, role';

function fields(body) {
  return [
    required(body.name, 'Name', 120),
    required(body.membership_id, 'Membership ID', 32),
    choice(body.role, ['admin', 'member'], 'Select a valid role.')
  ];
}

async function passwordHash(password) {
  if (!validPassword(password)) fail(400, 'Use a password between 8 and 128 characters.');
  return hashPassword(password);
}

users.get('/', async (_req, res) => {
  const [rows] = await db.query('SELECT ' + visibleFields + ' FROM users ORDER BY name, id');
  res.json(rows);
});

users.get('/:id', async (req, res) => {
  res.json(await one(db, 'SELECT ' + visibleFields + ' FROM users WHERE id = ?',
    [req.params.id], 'User not found.'));
});

users.post('/', async (req, res) => {
  const [result] = await db.execute(
    'INSERT INTO users (name, membership_id, role, password_hash) VALUES (?, ?, ?, ?)',
    [...fields(req.body), await passwordHash(req.body.password)]
  );
  res.status(201).json({ id: result.insertId });
});

users.put('/:id', async (req, res) => {
  const roleFields = fields(req.body);
  if (Number(req.params.id) === req.user.id && req.body.role !== 'admin') {
    fail(400, 'You cannot change your own administrator role.');
  }
  const changesPassword = Boolean(req.body.password);
  const values = changesPassword ? [...roleFields, await passwordHash(req.body.password)] : roleFields;
  const [result] = await db.execute(
    'UPDATE users SET name = ?, membership_id = ?, role = ?' +
    (changesPassword ? ', password_hash = ?' : '') + ' WHERE id = ?',
    [...values, req.params.id]
  );
  if (!result.affectedRows) fail(404, 'User not found.');
  res.sendStatus(204);
});

users.delete('/:id', async (req, res) => {
  if (Number(req.params.id) === req.user.id) fail(400, 'You cannot delete your own account.');
  const [result] = await db.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) fail(404, 'User not found.');
  res.sendStatus(204);
});
