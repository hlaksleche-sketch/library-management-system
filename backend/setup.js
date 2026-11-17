import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { connectionOptions, database } from './db.js';
import { hashPassword, validPassword } from './security.js';

const membershipId = process.env.ADMIN_MEMBERSHIP_ID || 'ADMIN001';
const password = process.env.ADMIN_PASSWORD;
if (!validPassword(password)) throw new Error('Set ADMIN_PASSWORD in backend/.env (8 to 128 characters).');
if (membershipId.length > 32 || !membershipId.trim()) throw new Error('Invalid ADMIN_MEMBERSHIP_ID.');

const connection = await mysql.createConnection({
  ...connectionOptions,
  multipleStatements: true
});
try {
  await connection.query('CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4', [database]);
  await connection.query('USE ??', [database]);
  await connection.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  const [existing] = await connection.execute(
    'SELECT id FROM users WHERE membership_id = ?', [membershipId.trim()]
  );
  if (!existing.length) {
    await connection.execute(
      'INSERT INTO users (name, membership_id, role, password_hash) VALUES (?, ?, ?, ?)',
      ['Library Administrator', membershipId.trim(), 'admin', await hashPassword(password)]
    );
  }
  console.log('Database ready. Administrator membership ID:', membershipId.trim());
} finally {
  await connection.end();
}
