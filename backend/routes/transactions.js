import { Router } from 'express';
import { atomic, db } from '../db.js';
import { choice, fail, integer, one } from '../validation.js';

export const transactions = Router();
const history = `SELECT t.id, t.book_id, b.title, t.kind, t.quantity,
       t.borrower_id, t.borrower_name, t.borrower_membership_id, t.created_at
       FROM stock_transactions t JOIN books b ON b.id = t.book_id`;

function movement(kind, quantity) {
  return kind === 'borrow' ? -quantity : quantity;
}

async function readMovement(connection, body) {
  const kind = choice(body.kind, ['stock_in', 'borrow'], 'Select a valid transaction type.');
  const quantity = integer(body.quantity, 'Quantity');
  const borrower = kind === 'borrow' ? await one(connection,
    'SELECT id, name, membership_id FROM users WHERE id = ? FOR SHARE',
    [integer(body.borrower_id, 'Borrower')], 'Borrower not found.'
  ) : null;
  return [kind, quantity, borrower?.id ?? null, borrower?.name ?? null, borrower?.membership_id ?? null];
}

async function adjustStock(connection, bookId, change, activeOnly = false) {
  const book = await one(connection,
    'SELECT quantity, archived_at FROM books WHERE id = ? FOR UPDATE', [bookId], 'Book not found.');
  if (activeOnly && book.archived_at) fail(409, 'This book has been archived.');
  const quantity = book.quantity + change;
  if (quantity < 0) fail(409, 'This change would leave fewer than zero copies in stock.');
  if (quantity > 2147483647) fail(409, 'The resulting quantity exceeds the stock limit.');
  await connection.execute('UPDATE books SET quantity = ? WHERE id = ?', [quantity, bookId]);
}

async function lockTransaction(connection, id) {
  return one(connection,
    'SELECT book_id, kind, quantity FROM stock_transactions WHERE id = ? FOR UPDATE',
    [id], 'Transaction not found.');
}

transactions.get('/', async (_req, res) => {
  const [rows] = await db.query(history + ' ORDER BY t.id DESC');
  res.json(rows);
});

transactions.get('/:id', async (req, res) => {
  res.json(await one(db, history + ' WHERE t.id = ?', [req.params.id], 'Transaction not found.'));
});

transactions.post('/', async (req, res) => {
  const bookId = integer(req.body.book_id, 'Book');
  const id = await atomic(async (connection) => {
    const values = await readMovement(connection, req.body);
    await adjustStock(connection, bookId, movement(values[0], values[1]), true);
    const [result] = await connection.execute(
      `INSERT INTO stock_transactions
       (book_id, kind, quantity, borrower_id, borrower_name, borrower_membership_id)
       VALUES (?, ?, ?, ?, ?, ?)`, [bookId, ...values]
    );
    return result.insertId;
  });
  res.status(201).json({ id });
});

transactions.put('/:id', async (req, res) => {
  await atomic(async (connection) => {
    const values = await readMovement(connection, req.body);
    const previous = await lockTransaction(connection, req.params.id);
    if (req.body.book_id !== undefined && req.body.book_id !== previous.book_id) {
      fail(400, 'The book on an existing transaction cannot be changed.');
    }
    const difference = movement(values[0], values[1]) - movement(previous.kind, previous.quantity);
    await adjustStock(connection, previous.book_id, difference);
    await connection.execute(
      `UPDATE stock_transactions SET kind = ?, quantity = ?, borrower_id = ?,
       borrower_name = ?, borrower_membership_id = ? WHERE id = ?`, [...values, req.params.id]
    );
  });
  res.sendStatus(204);
});

transactions.delete('/:id', async (req, res) => {
  await atomic(async (connection) => {
    const previous = await lockTransaction(connection, req.params.id);
    await adjustStock(connection, previous.book_id, -movement(previous.kind, previous.quantity));
    await connection.execute('DELETE FROM stock_transactions WHERE id = ?', [req.params.id]);
  });
  res.sendStatus(204);
});
