# Mini CRM — Client Lead Management System

A small, working CRM for agencies, freelancers, and startups to capture leads from a
website contact form, track them through a pipeline (**New → Contacted → Converted**),
log follow-up notes, and see basic conversion analytics — all behind a secure admin login.

Built as a real system you could hand to a small business, not a toy demo: it has
real auth, input validation, rate limiting on public endpoints, and a proper
client/server split.

---

## Features

- **Public lead capture** — a sample business contact form (`contact.html`) posts
  straight into the CRM through an unauthenticated, rate-limited API endpoint.
- **Secure admin dashboard** — everything except login and the public contact
  form requires a valid admin JWT session.
- **Lead pipeline board** — leads are grouped into three columns (New, Contacted,
  Converted). Drag a card to a new column, or open it and pick a status.
- **Follow-up notes** — timestamped notes per lead, so nothing falls through the
  cracks.
- **Search & filter** — search by name, email, company, or source; sort newest
  or oldest.
- **Analytics** — total leads, breakdown by status, conversion rate, and leads
  received in the last 7 days.
- **Delete leads** — clean up test/spam submissions.

---

## Tech stack

| Layer     | Choice                                                              |
|-----------|----------------------------------------------------------------------|
| Frontend  | Plain HTML / CSS / JavaScript (no build step required)              |
| Backend   | Node.js + Express                                                    |
| Database  | [lowdb](https://github.com/typicode/lowdb) — a JSON-file database   |
| Auth      | JWT (`jsonwebtoken`) + bcrypt password hashing                      |
| Security  | `express-rate-limit` on public/login endpoints, CORS config          |

**Why lowdb instead of MongoDB/MySQL?** The task allows any DB you're comfortable
with. lowdb keeps this project runnable anywhere with zero external services —
no database server to install or connect to, which matters a lot for a
take-home/portfolio project a reviewer just wants to `npm install` and run.
The data layer is isolated in `backend/db.js` — swapping it for MongoDB
(Mongoose) or MySQL (Sequelize/Prisma) later only means rewriting that one
file and the route handlers that call `db.data.leads`; the API contract and
frontend don't change.

---

## Project structure

```
crm-mini/
├── backend/
│   ├── data/                 # lowdb JSON file lives here (gitignored)
│   ├── middleware/
│   │   └── auth.js           # JWT verification middleware
│   ├── routes/
│   │   ├── auth.js           # POST /api/auth/login, GET /api/auth/me
│   │   ├── leads.js          # protected CRUD + analytics for leads
│   │   └── public.js         # POST /api/public/leads (contact form target)
│   ├── db.js                 # lowdb setup
│   ├── seed.js                # creates the admin account + sample leads
│   ├── server.js              # Express app entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── css/
│   │   ├── style.css         # dark admin dashboard theme
│   │   └── public.css        # light public contact-form theme
│   ├── js/
│   │   ├── api.js            # shared fetch/session helper
│   │   ├── login.js
│   │   ├── app.js            # dashboard logic (board, modal, notes)
│   │   └── contact.js
│   ├── index.html            # admin dashboard (protected)
│   ├── login.html            # admin login
│   └── contact.html          # sample public "business website" contact form
├── .gitignore
└── README.md
```

---

## Setup instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) 18+ and npm

### 2. Install backend dependencies
```bash
cd backend
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and set:
- `JWT_SECRET` — any long random string (this signs admin login sessions)
- `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` — the admin account created
  the first time you seed the database

### 4. Seed the database
Creates the admin account and a few sample leads so the dashboard isn't empty:
```bash
npm run seed
```
Safe to re-run — it only creates what's missing.

### 5. Start the server
```bash
npm start
```
You should see:
```
Mini CRM API running on http://localhost:4000
```

The Express server also serves the `frontend/` folder statically, so the whole
app is available at:

- **Admin login:** http://localhost:4000/login.html
- **Dashboard:** http://localhost:4000/index.html
- **Public contact form:** http://localhost:4000/contact.html

Log in with the credentials from your `.env` file (defaults to
`admin@minicrm.com` / `ChangeMe123!` unless you changed them).

> Prefer running the frontend separately (e.g. VS Code Live Server)? It works
> the same way — `frontend/js/api.js` automatically points at
> `http://localhost:4000` whenever it isn't being served from port 4000 itself.
> Just update `CORS_ORIGIN` in `.env` to match wherever you're serving it from.

### 6. Try the full flow
1. Open **contact.html** and submit the form — this simulates a real client
   inquiry landing on a business website.
2. Open **login.html**, sign in, and watch the new lead appear in the
   **New** column on the dashboard.
3. Click the card, add a follow-up note, and change its status to
   **Contacted**, then **Converted** (or just drag it between columns).
4. Watch the stat cards at the top update.

---

## API reference

All protected routes require `Authorization: Bearer <token>`, obtained from
`POST /api/auth/login`.

| Method | Endpoint                          | Auth | Description                                   |
|--------|------------------------------------|------|------------------------------------------------|
| POST   | `/api/public/leads`               | No   | Submit a new lead (the contact form target)     |
| POST   | `/api/auth/login`                 | No   | Admin login → returns `{ token, admin }`        |
| GET    | `/api/auth/me`                    | Yes  | Verify current session                          |
| GET    | `/api/leads`                      | Yes  | List leads. Query: `search`, `status`, `sort`   |
| GET    | `/api/leads/analytics/summary`    | Yes  | Totals, status breakdown, conversion rate       |
| GET    | `/api/leads/:id`                  | Yes  | Get a single lead                               |
| PATCH  | `/api/leads/:id/status`           | Yes  | Body: `{ "status": "new\|contacted\|converted" }` |
| POST   | `/api/leads/:id/notes`            | Yes  | Body: `{ "text": "..." }` — adds a follow-up note |
| DELETE | `/api/leads/:id`                  | Yes  | Delete a lead                                   |

Public lead submissions and admin login are both rate-limited to reduce abuse.

---

## Security notes

- Passwords are hashed with bcrypt — never stored in plain text.
- Admin sessions are short-lived JWTs (default 8h, configurable via
  `JWT_EXPIRES_IN`).
- There's intentionally **no public sign-up endpoint** for admins — accounts
  are created via the seed script, so a random visitor can never create
  themselves an admin login.
- The only unauthenticated write endpoint (`/api/public/leads`) is rate
  limited and only accepts a small, validated set of fields.

For production use, you'd also want to: put this behind HTTPS, rotate
`JWT_SECRET` out of source control (already gitignored here via `.env`), and
migrate `backend/data/db.json` to a real database if you expect concurrent
writes at scale.

---

## Possible next steps

- Swap lowdb for MongoDB/MySQL for multi-instance deployments
- Add email notifications when a new lead comes in
- Multiple admin roles (e.g. sales rep vs. owner)
- CSV export of leads
- Pagination for large lead lists