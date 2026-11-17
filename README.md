# Library Management System

This BIWA2110 project keeps track of library books, available copies, and registered members. An administrator can add books, update stock, and record who borrowed a copy. Members can sign in and check which books are available.

## Run on Windows

Install Node.js 22.12 or later and start your MySQL 8 server. Extract the ZIP and open the `library-management` folder in VS Code. Use PowerShell in the VS Code terminal. If PowerShell blocks `npm.ps1`, use `npm.cmd` as shown below.

### 1. Start the backend

From the project folder, run:

```powershell
cd backend
Copy-Item .env.example .env
```

Open `backend/.env` in VS Code. Set `DB_PASSWORD` to your MySQL password and set `ADMIN_PASSWORD` to a password of your choice with 8 to 128 characters. The example uses the MySQL user `root` and port `3306`. Update them if your server uses different settings. If a password contains a `#` or significant leading or trailing spaces, wrap the value in quotes in the env file.

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd start
```

The setup command uses `schema.sql` to create the database tables and adds your first administrator. The MySQL account you use needs permission to create the database and its tables. If you run setup again, it keeps your existing data and administrator password. Once you see `Library API on http://127.0.0.1:3001`, leave that terminal open.

### 2. Start the frontend

Open a second terminal at the project folder:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:5173**. Sign in with membership ID **ADMIN001** (or the ID you set in `backend/.env`) and the administrator password you chose.

If you change the API port, set `VITE_API_URL` in `frontend/.env` to the matching backend URL. If you change the frontend origin, update `FRONTEND_ORIGIN` in `backend/.env`.

## Try a quick demo

1. In Book Management, add *Pride and Prejudice* by Jane Austen. Use Fiction as the genre, `9780141439518` as the ISBN, and start with one copy. Open the Dashboard to see the low-stock label.
2. In User Management, add a member and give them a password. Try editing their name.
3. In Transactions, add three copies of the book. Borrow two copies for the member. The history should show both movements and the Dashboard should show two copies available.
4. Try borrowing three more copies. The API should reject the request and keep the quantity at two.
5. Edit the borrowing transaction from two copies to one. The quantity should rise to three. Delete the borrowing transaction and the quantity should rise to four.
6. Sign out and sign in as the member. The Dashboard should be available. Administrator pages and API operations require the admin role.

## What happens when someone borrows a book?

1. In Transactions, choose the book, the member, and the number of copies.
2. The React form sends those details to Express using Fetch. Express checks that you are signed in as an administrator.
3. The backend checks the available copies in MySQL. If there is enough stock, it saves the borrowing record and updates the book quantity together.
4. The transaction appears in the history, and the Dashboard shows the new number of available copies.

## Where to find the code

| File or directory | Purpose |
| --- | --- |
| `frontend/src/main.jsx` | React Router navigation, sign-in state and role-based routes |
| `frontend/src/pages.jsx` | The four pages and their controlled forms |
| `frontend/src/components.jsx` | Shared tables, editors and the data-loading hook |
| `frontend/src/api.js` | Fetch requests and API error handling |
| `backend/routes/` | REST routes for books, transactions and users |
| `backend/db.js` | MySQL connection pool and atomic database updates |
| `backend/schema.sql` | Tables and relationships |
| `backend/security.js` | Password hashing and session-token hashing |

### API at a glance

| Route | Methods | Access |
| --- | --- | --- |
| `/login` | POST | Public |
| `/me`, `/logout` | GET, POST respectively | Signed-in users |
| `/books`, `/books/:id` | GET, POST (collection), PUT and DELETE (item) | All signed-in users can read. Admins can write. |
| `/transactions`, `/transactions/:id` | GET, POST (collection), PUT and DELETE (item) | Admin |
| `/users`, `/users/:id` | GET, POST (collection), PUT and DELETE (item) | Admin |

Each stock change updates the book and its transaction in one database transaction. The API locks the book row while calculating the new quantity. Editing a transaction applies the difference between the old and new stock movements. Deleting it reverses the movement. Book deletion archives the title so it remains visible in transaction history. Borrowing records retain the borrower's name and membership ID after user deletion.

## Submit on GitHub

Create an empty repository on GitHub. From the extracted project folder run:

```powershell
git init
git add .
git commit -m "Build library management system"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace the example repository URL with your own. Submit that GitHub repository link and ensure your lecturer can open it. The repository root should contain both `frontend/` and `backend/`. The `.gitignore` excludes local credentials, installed packages, and the frontend build directory.
