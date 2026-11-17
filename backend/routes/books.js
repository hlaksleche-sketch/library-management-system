import { Router } from 'express';
import { db } from '../db.js';
import { fail, integer, one, required } from '../validation.js';

export const books = Router();

function fields(body) {
  const isbn = required(body.isbn, 'ISBN', 30).replace(/[ -]/g, '').toUpperCase();
  if (!/^(\d{9}[\dX]|\d{13})$/.test(isbn)) fail(400, 'Enter a 10- or 13-character ISBN.');
  return [
    required(body.title, 'Title', 160),
    required(body.author, 'Author', 120),
    required(body.genre, 'Genre', 80),
    isbn
  ];
}

books.get('/', async (_req, res) => {
  const [rows] = await db.query(
    'SELECT id, title, author, genre, isbn, quantity FROM books WHERE archived_at IS NULL ORDER BY title, id'
  );
  res.json(rows);
});

books.get('/:id', async (req, res) => {
  res.json(await one(db,
    'SELECT id, title, author, genre, isbn, quantity FROM books WHERE id = ? AND archived_at IS NULL',
    [req.params.id], 'Book not found.'
  ));
});

books.post('/', async (req, res) => {
  const [result] = await db.execute(
    'INSERT INTO books (title, author, genre, isbn, quantity) VALUES (?, ?, ?, ?, ?)',
    [...fields(req.body), integer(req.body.quantity, 'Initial quantity', 0)]
  );
  res.status(201).json({ id: result.insertId });
});

books.put('/:id', async (req, res) => {
  const [result] = await db.execute(
    'UPDATE books SET title = ?, author = ?, genre = ?, isbn = ? WHERE id = ? AND archived_at IS NULL',
    [...fields(req.body), req.params.id]
  );
  if (!result.affectedRows) fail(404, 'Book not found.');
  res.sendStatus(204);
});

books.delete('/:id', async (req, res) => {
  const [result] = await db.execute(
    'UPDATE books SET archived_at = CURRENT_TIMESTAMP WHERE id = ? AND archived_at IS NULL',
    [req.params.id]
  );
  if (!result.affectedRows) fail(404, 'Book not found.');
  res.sendStatus(204);
});
