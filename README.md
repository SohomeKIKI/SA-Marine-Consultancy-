# Batch CRM — Web-Based Internal Management System

Batch CRM is a high-reliability internal CRM built from scratch to manage admission batches, colleges, students, fee payments, and notifications with role-based access control and an immutable audit log.

---

## Tech Stack

- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 (ORM), Alembic (migrations), PostgreSQL 16 (production/Docker) & SQLite fallback (isolated host tests), `passlib` with `argon2` for password hashing, `PyJWT` for JWT tokens, `pytest` and `httpx` for test automation.
- **Frontend:** React 18, Vite, TypeScript, React Router v6, TanStack Query v5, React Hook Form with Zod, Tailwind CSS, Lucide React icons, and Vitest.
- **Infrastructure:** Docker Compose with services for `api`, `web`, and `db` (Postgres 16). `.env.example` included; secrets are never hardcoded.

---



## Role & Permissions Matrix

| Action | Admin | Employee | Server Enforcement |
|---|:---:|:---:|---|
| **Log in & Log out** | Yes | Yes | Public endpoints; sets `httpOnly` JWT cookies |
| **Create batch** | Yes | No | `require_admin` dependency (HTTP 403) |
| **View batches** | Yes | Yes | `require_employee_or_admin` |
| **Create college** | Yes | No | `require_admin` dependency (HTTP 403) |
| **View colleges** | Yes | Yes | `require_employee_or_admin` |
| **Link/Unlink college to batch** | Yes | No | `require_admin` (HTTP 403; HTTP 409 if students enrolled) |
| **Deactivate a college** | Yes | No | `require_admin` (Sets `is_active=False`) |
| **Delete a college** | **Never** | **Never** | Not supported at all in service or API layer |
| **Create student** | Yes | Yes | `require_employee_or_admin` (auto-generates `STU-YYYY-XXXXXX`) |
| **Edit student** | Yes | Yes | `require_employee_or_admin` (field-level audit diff logged) |
| **Delete student** | Yes | No | `require_admin` dependency (HTTP 403 for employee) |
| **Add payment** | Yes | Yes | `require_employee_or_admin` (amount > 0, online account checked) |
| **Edit or delete payment** | Yes | No | `require_admin` dependency (HTTP 403 for employee) |
| **View audit log** | Yes | No | `require_admin` dependency (HTTP 403 for employee) |
| **Manage employees (`/admin/users`)** | Yes | No | `require_admin` (HTTP 403; no-self-deactivation; 0-admin block HTTP 409) |
| **Update profile display name (`/me`)** | Yes | Yes | `require_active_user` (updates `display_name` only; audits diff) |
| **Change password (`/me/change-password`)** | Yes | Yes | `require_active_user` (verifies current, min 8 chars, revokes other sessions) |
| **Receive edit notifications** | Yes | No | Fan-out triggered on employee student edits (uses `display_name` or `email`) |

---

## Project Structure

```
batch-crm/
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application entrypoint with CORS & routers
│   │   ├── core/                       # config.py, security.py, deps.py, db.py
│   │   ├── iam/                        # User, RefreshToken, login, refresh, throttling, logout
│   │   ├── audit/                      # Append-only AuditLog model, service, view dependency, admin viewer
│   │   ├── batches/                    # Batch, College, BatchCollege link/unlink with 409 conflict check
│   │   ├── students/                   # Student model, auto student number, field-level edit logging
│   │   ├── payments/                   # Payment model, validation, totals logic, admin edit/delete
│   │   └── notifications/              # Real-time notification fan-out and unread polling
│   ├── migrations/                     # Alembic migration scripts
│   ├── tests/                          # 36 comprehensive backend tests (pytest)
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── api/                        # Typed API client with credentials & token refresh
    │   ├── auth/                       # AuthContext, RequireAuth & RequireAdmin route guards
    │   ├── components/                 # Layout with 30s notification polling and header
    │   ├── features/                   # Batches, Colleges, Students, Payments, Audit Log
    │   └── App.tsx                     # Main router with protected and admin routes
    ├── package.json
    └── Dockerfile
```

---

## Quickstart with Docker Compose

Ensure Docker is running on your machine, then run:

```bash
cd batch-crm
cp .env.example .env
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/health](http://localhost:8000/health)

### Default Administrator Credentials

| Field | Value |
|---|---|
| **Email** | `admin@batchcrm.com` |
| **Password** | `AdminPassword123!` |

> *Note: These credentials are set during the initial database seed and can be customized via `FIRST_ADMIN_EMAIL` and `FIRST_ADMIN_PASSWORD` in `.env`.*


---

## Running Locally on Host (Without Docker)

### 1. Backend Setup

```bash
cd batch-crm/backend

# Create virtual environment & activate
python -m venv .venv
.\.venv\Scripts\activate   # Windows
# source .venv/bin/activate # Linux / macOS

# Install dependencies
pip install -r requirements.txt

# Seed initial admin user
python -m app.iam.seed

# Start backend server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
cd batch-crm/frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Running Tests

### Backend Tests (Pytest)

The backend test suite includes 49 tests covering:
- Authentication, session rotation, login throttling, and token reuse attack detection (`test_iam.py`)
- Admin employee management, password resets, session revocations, self-action protections, and last-admin 409 conflict checks (`test_admin_users.py`)
- User profile updates, display name field-diff audits, role elevation prevention, password changes, and other-session revocation (`test_profile.py`)
- Student edit notification fan-out with display name fallback (`test_notifications.py`)
- Immutable audit log append-only rules, multi-filter searches, and rollback atomicity (`test_audit.py`)
- Batch/college linking with enrolled student 409 conflict protection (`test_batches.py`)
- Sequence-backed student enrollment and field-level diff logging (`test_students.py`)
- Financial payment creation and admin payment edit/delete (`test_payments.py`)

```bash
cd batch-crm/backend
.\.venv\Scripts\pytest -v
```

Expected result:
```
======================= 49 passed, 6 warnings in 17.80s =======================
```

### Frontend Tests (Vitest)

The frontend test suite includes 13 tests across 5 test suites:
- Role guards (`RequireAuth`, `RequireAdmin` redirect and access-denied enforcement)
- Payment panel role-based button visibility (Employee vs Admin controls)
- Employees page directory rendering and admin guard
- Profile page display name update, password validation, and credential change forms

```bash
cd batch-crm/frontend
npm run test
```

Expected result:
```
Test Files  5 passed (5)
     Tests  13 passed (13)
```

### Frontend Production Build Check

```bash
cd batch-crm/frontend
npm run build
```
