import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { request } from './api.js';
import { Dashboard, BooksPage, TransactionsPage, UsersPage, Login } from './pages.jsx';
import './style.css';

const sessionKey = 'biwa-library-token';
const managementLinks = [
  ['/books', 'Book Management'],
  ['/transactions', 'Transactions'],
  ['/users', 'User Management']
];

function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem(sessionKey));
  const [user, setUser] = useState(null);
  const [sessionError, setSessionError] = useState('');

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(sessionKey);
    setToken(null);
    setUser(null);
    setSessionError('');
  }, []);

  const api = useCallback(async (path, options) => {
    try {
      return await request(path, { ...options, token });
    } catch (problem) {
      if (problem.status === 401) clearSession();
      throw problem;
    }
  }, [token, clearSession]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    api('/me').then((profile) => {
      if (active) setUser(profile);
    }).catch((problem) => {
      if (active && problem.status !== 401) setSessionError(problem.message);
    });
    return () => { active = false; };
  }, [token, api]);

  async function login(values) {
    const session = await request('/login', { method: 'POST', body: values });
    sessionStorage.setItem(sessionKey, session.token);
    setToken(session.token);
    setUser(session.user);
  }

  async function logout() {
    try {
      await api('/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }

  if (!token) return <Login onLogin={login} />;
  if (!user) return <main className="content">
    {sessionError
      ? <><p role="alert">{sessionError}</p><button onClick={clearSession}>Back to sign in</button></>
      : <p role="status">Checking your session…</p>}
  </main>;

  const admin = user.role === 'admin';
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header>
      <div className="header-inner">
        <NavLink to="/" className="brand">Library Management</NavLink>
        <div className="account">
          <span>{user.name} · {admin ? 'Administrator' : 'Member'}</span>
          <button className="sign-out" onClick={() => { logout().catch(() => {}); }}>Sign out</button>
        </div>
      </div>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>Dashboard</NavLink>
        {admin && managementLinks.map(([path, label]) => <NavLink to={path} key={path}>{label}</NavLink>)}
      </nav>
    </header>
    <main id="main" className="content">
      <Routes>
        <Route path="/" element={<Dashboard api={api} />} />
        {admin && <>
          <Route path="/books" element={<BooksPage api={api} />} />
          <Route path="/transactions" element={<TransactionsPage api={api} />} />
          <Route path="/users" element={<UsersPage api={api} user={user} />} />
        </>}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </>;
}

createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);
