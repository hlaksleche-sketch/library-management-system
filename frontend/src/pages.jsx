import React, { useState } from 'react';
import { Actions, AdminPage, Editor, Fields, Notice, Table, useRecords } from './components.jsx';

const bookPaths = ['/books'];
const userPaths = ['/users'];
const transactionPaths = ['/transactions', '/books', '/users'];

function StockStatus({ quantity }) {
  if (quantity === 0) return <span className="badge low">Out of stock</span>;
  if (quantity < 2) return <span className="badge low">Low stock</span>;
  return <span className="badge">Available</span>;
}

function BookList({ books, actions }) {
  const columns = ['Title', 'Author', 'Genre', 'ISBN', 'Copies', 'Status'];
  if (actions) columns.push('Actions');
  return <Table columns={columns} rows={books} empty="No books found." renderRow={(book) => <>
    <td className="primary-cell">{book.title}</td><td>{book.author}</td>
    <td>{book.genre}</td><td>{book.isbn}</td><td>{book.quantity}</td>
    <td><StockStatus quantity={book.quantity} /></td>
    {actions && <td><Actions disabled={actions.busy} onEdit={() => actions.onEdit(book)}
      onDelete={() => actions.remove(book, 'Delete “' + book.title + '” from the catalogue?')} /></td>}
  </>} />;
}

export function Dashboard({ api }) {
  const { records, error } = useRecords(api, bookPaths);
  const [filter, setFilter] = useState('');
  const books = records?.[0];
  const search = filter.trim().toLowerCase();
  return <>
    <h1>Dashboard</h1>
    <Notice error={error} />
    {books ? <>
      <div className="stats">
        <div className="panel stat"><span>Book titles</span><strong>{books.length}</strong></div>
        <div className="panel stat"><span>Available copies</span><strong>{books.reduce((total, book) => total + book.quantity, 0)}</strong></div>
        <div className="panel stat warn"><span>Low or out of stock</span><strong>{books.filter((book) => book.quantity < 2).length}</strong></div>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>Book availability</h2>
          <input type="search" aria-label="Search books" placeholder="Search title, author or ISBN"
            value={filter} onChange={(event) => setFilter(event.target.value)} />
        </div>
        <BookList books={books.filter((book) => [book.title, book.author, book.isbn]
          .some((value) => value.toLowerCase().includes(search)))} />
      </section>
    </> : !error && <p role="status">Loading…</p>}
  </>;
}

const textField = (name, label, maxLength) => ({ name, label, maxLength, required: true });
const quantityField = (label, min) => ({
  name: 'quantity', label, type: 'number', min, max: 2147483647, step: 1, required: true
});

function BookForm({ onSave, selected, ...props }) {
  const fields = [
    textField('title', 'Title', 160), textField('author', 'Author', 120),
    textField('genre', 'Genre', 80),
    { ...textField('isbn', 'ISBN', 30), pattern: '[0-9Xx \\-]{10,30}', title: 'Enter a 10- or 13-character ISBN' }
  ];
  if (!selected) fields.push(quantityField('Initial quantity', 0));
  return <Editor {...props} selected={selected} title={selected ? 'book' : 'Add book'}
    fields={fields} defaults={{ quantity: 1 }} saveLabel={selected ? 'Save changes' : 'Add book'}
    onSave={(values) => onSave({ ...values, quantity: Number(values.quantity) })} />;
}

export function BooksPage({ api }) {
  return <AdminPage api={api} paths={bookPaths} endpoint="/books" title="Book Management"
    messages={{ created: 'Book added to the catalogue.', updated: 'Book details updated.', deleted: 'Book removed from the catalogue.' }}
    renderEditor={({ key, ...props }) => <BookForm key={key} {...props} />}
    renderList={(books, actions) => <section className="panel">
      <h2>Catalogue</h2><BookList books={books} actions={actions} />
    </section>} />;
}

const types = [['stock_in', 'Add stock'], ['borrow', 'Borrow copies']];

function TransactionForm({ selected, books, users, onSave, onCancel, busy }) {
  const [values, setValues] = useState(() => ({ kind: 'stock_in', quantity: 1, ...selected }));
  const fields = [
    { name: 'book_id', label: 'Book', required: true, disabled: Boolean(selected),
      options: selected ? [[selected.book_id, selected.title]] : [
        ['', 'Select a book'], ...books.map((book) => [book.id, book.title + ' (' + book.quantity + ' available)'])
      ] },
    { name: 'kind', label: 'Transaction type', options: types },
    quantityField('Copies', 1)
  ];
  if (values.kind === 'borrow') fields.push({
    name: 'borrower_id', label: 'Borrower', required: true,
    options: [['', 'Select a user'], ...users.map((user) => [user.id, user.name + ' (' + user.membership_id + ')'])]
  });
  return <form className="panel editor" onSubmit={(event) => {
    event.preventDefault();
    onSave({
      book_id: Number(values.book_id),
      kind: values.kind,
      quantity: Number(values.quantity),
      borrower_id: values.kind === 'borrow' ? Number(values.borrower_id) : null
    });
  }}>
    <h2>{selected ? 'Edit transaction' : 'Record transaction'}</h2>
    {!selected && !books.length && <p className="muted">Add a book before recording a transaction.</p>}
    <Fields fields={fields} values={values}
      onChange={(name, value) => setValues((previous) => ({ ...previous, [name]: value }))} />
    <div className="actions">
      <button disabled={busy || (!selected && !books.length)}>{selected ? 'Save changes' : 'Record transaction'}</button>
      {selected && <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}

export function TransactionsPage({ api }) {
  return <AdminPage api={api} paths={transactionPaths} endpoint="/transactions" title="Transactions"
    messages={{ created: 'Transaction recorded.', updated: 'Transaction updated.', deleted: 'Transaction deleted and stock adjusted.' }}
    renderEditor={({ key, ...props }, [, books, users]) => <TransactionForm key={key} {...props} books={books} users={users} />}
    renderList={(rows, actions) => <section className="panel">
      <h2>Transaction history</h2>
      <Table columns={['Book', 'Type', 'Copies', 'Borrower', 'Recorded', 'Actions']} rows={rows}
        empty="Stock added and books borrowed will appear here." renderRow={(row) => <>
          <td className="primary-cell">{row.title}</td>
          <td><span className={'badge ' + (row.kind === 'borrow' ? 'low' : '')}>
            {row.kind === 'borrow' ? 'Borrowed' : 'Stock added'}
          </span></td>
          <td>{row.kind === 'borrow' ? '−' : '+'}{row.quantity}</td>
          <td>{row.borrower_name ? row.borrower_name + ' (' + row.borrower_membership_id + ')' : '—'}</td>
          <td>{new Date(row.created_at).toLocaleString()}</td>
          <td><Actions disabled={actions.busy} onEdit={() => actions.onEdit(row)}
            onDelete={() => actions.remove(row, 'Delete this transaction and reverse its stock movement?')} /></td>
        </>} />
    </section>} />;
}

function UserForm({ selected, ...props }) {
  const fields = [
    textField('name', 'Full name', 120), textField('membership_id', 'Membership ID', 32),
    { name: 'role', label: 'Role', options: [['member', 'Member'], ['admin', 'Administrator']] },
    { name: 'password', label: selected ? 'New password (optional)' : 'Password', type: 'password',
      required: !selected, minLength: 8, maxLength: 128, autoComplete: 'new-password' }
  ];
  return <Editor {...props} selected={selected} title={selected ? 'user' : 'Add user'}
    fields={fields} defaults={{ role: 'member' }} saveLabel={selected ? 'Save changes' : 'Add user'} />;
}

export function UsersPage({ api, user }) {
  return <AdminPage api={api} paths={userPaths} endpoint="/users" title="User Management"
    messages={{ created: 'User account added.', updated: 'User details updated.', deleted: 'User account deleted.' }}
    renderEditor={({ key, ...props }) => <UserForm key={key} {...props} />}
    renderList={(rows, actions) => <section className="panel">
      <h2>Users</h2>
      <Table columns={['Name', 'Membership ID', 'Role', 'Actions']} rows={rows}
        empty="No users to display." renderRow={(row) => <>
          <td className="primary-cell">{row.name}{row.id === user.id ? ' (you)' : ''}</td>
          <td>{row.membership_id}</td>
          <td>{row.role === 'admin' ? 'Administrator' : 'Member'}</td>
          <td>{row.id === user.id
            ? <button className="secondary" disabled={actions.busy} onClick={() => actions.onEdit(row)}>Edit</button>
            : <Actions disabled={actions.busy} onEdit={() => actions.onEdit(row)}
                onDelete={() => actions.remove(row, 'Delete the account for ' + row.name + '?')} />}</td>
        </>} />
    </section>} />;
}

const loginFields = [
  { ...textField('membership_id', 'Membership ID', 32), autoComplete: 'username' },
  { name: 'password', label: 'Password', type: 'password', required: true, maxLength: 128, autoComplete: 'current-password' }
];

export function Login({ onLogin }) {
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onLogin(values);
    } catch (problem) {
      setError(problem.message);
      setBusy(false);
    }
  }
  return <main className="login">
    <form className="panel editor" onSubmit={submit}>
      <p className="brand">Library Management</p>
      <h1>Sign in</h1>
      <Notice error={error} />
      <Fields fields={loginFields} values={values}
        onChange={(name, value) => setValues((previous) => ({ ...previous, [name]: value }))} />
      <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>;
}
