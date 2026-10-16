# Changelog

All notable changes to **Batch CRM** are documented in this file stage by stage.

---

## Assumptions & Design Defaults (Pre-Stage 1)
- **Local Testing without Docker:** When Docker daemon is not active on the host machine, pytest automatically uses an in-memory SQLite database configured with SQLAlchemy compatibility (JSON fallback and custom sequence handler) so all tests can run natively on any OS without requiring a running PostgreSQL service. In Docker / staging / production, PostgreSQL 16 is used with native JSONB and Sequences.
- **Student ID Generation:** Student IDs are generated using the format `STU-YYYY-XXXXXX` (e.g. `STU-2026-000001`), using the Batch's year (or current creation year) combined with an incremental sequence.
- **Audit Log Append-Only:** PostgreSQL migrations enforce strict table permissions (`INSERT`, `SELECT` only; revoking `UPDATE` and `DELETE`). In addition, the ORM service provides strictly append-only methods.
- **Authentication Cookies & CORS:** Access tokens (15m expiry) and Refresh tokens (7d expiry) are sent via `httpOnly`, `Secure` (configurable via `SECURE_COOKIES` env, false for local dev HTTP), `SameSite` cookies.
- **Login Throttling:** Failed login attempts are recorded with timestamp and email in the database to enforce 5 attempts per 15 minutes lockout per email.
- **Notifications Fan-out:** Only employee edits trigger notifications to all active admin users (not admin self-edits).

---

## Stage 1: Scaffold
- **Status:** Completed
- **Components Built:**
  - Monorepo folder layout under `batch-crm/`.
  - `docker-compose.yml` defining `api`, `web`, and `db` (Postgres 16) services.
  - `.env.example` with complete configuration keys and dev defaults.
  - Backend FastAPI app with Pydantic v2 settings, SQLite/PostgreSQL engine support, CORS middleware, and health endpoints (`/health`, `/api/health`, `/api/health/db`).
  - Alembic migration environment initialized (`alembic.ini`, `migrations/env.py`, `migrations/script.py.mako`).
  - Frontend initialized with Vite, React 18, TypeScript, Tailwind CSS, Lucide icons, Vitest test suite, and verified production build.
  - Test suites: Backend pytest (3/3 health tests passing) and Frontend Vitest (1/1 test passing).

## Stage 2: IAM (Identity and Access Management)
- **Status:** Completed
- **Components Built:**
  - `User`, `RefreshToken`, and `FailedLoginAttempt` models in `backend/app/iam/models.py`.
  - Password hashing with `argon2` via `passlib` and JWT creation/validation with `pyjwt` in `backend/app/core/security.py`.
  - Service functions for authentication, login throttling (max 5 failed attempts per 15 minutes), session creation, refresh token rotation, token reuse detection (revokes all user tokens if a revoked token is replayed), and session revocation in `backend/app/iam/service.py`.
  - FastAPI dependencies (`get_current_user`, `get_current_active_user`, `require_admin`, `require_employee_or_admin`) supporting httpOnly cookie extraction with Bearer header fallback in `backend/app/core/deps.py`.
  - IAM routes (`/login`, `/refresh`, `/logout`, `/me`, `/users`, `/users/{id}/deactivate`, `/users/{id}/revoke-sessions`) with cookie management in `backend/app/iam/routes.py`.
  - Idempotent seed script (`backend/app/iam/seed.py`) creating the default administrator from environment variables.
  - Comprehensive test suite in `backend/tests/test_iam.py` verifying all 9 authentication and role enforcement requirements (12/12 passing tests).

## Stage 3: Audit Log
- **Status:** Completed
- **Components Built:**
  - `AuditLog` append-only database model in `backend/app/audit/models.py`.
  - Transaction-bound `audit.record` service in `backend/app/audit/service.py` with field-level diff calculation (`old_value` and `new_value`), zero-log emission when values are unchanged, and read-only paginated query filtering.
  - Reusable `audit_view` FastAPI dependency for entity view auditing in `backend/app/audit/deps.py`.
  - Admin-only endpoint `GET /api/audit/logs` with multi-field filtering (`user_id`, `entity_type`, `entity_id`, `action`, `start_date`, `end_date`) and pagination in `backend/app/audit/routes.py`.
  - Database migration in `backend/migrations/versions/2026_01_01_0001_audit_log_permissions.py` applying PostgreSQL permission grants (`INSERT`, `SELECT` only; revoking `UPDATE`, `DELETE`).
  - Unit and integration tests in `backend/tests/test_audit.py` verifying service immutability, field-level diffs, transaction rollback atomicity, admin filtering, and employee 403 access control (17/17 cumulative tests passing).

## Stage 4: Batches & Colleges
- **Status:** Completed
- **Components Built:**
  - `Batch`, `College`, and `BatchCollege` models in `backend/app/batches/models.py`.
  - Batch month/year uniqueness, automatic naming format ("Month Year", e.g. "January 2026").
  - College creation, active state management, and strict never-delete guarantee in service and routing.
  - Linking and unlinking batch-colleges with student conflict protection: blocks unlinking with HTTP 409 and enrolled student count.
  - Role-based access control: Admin can create batches, create/deactivate colleges, link/unlink colleges; Employees can view batches and colleges, with write actions returning HTTP 403 Forbidden.
  - Integration test suite in `backend/tests/test_batches.py` (7 tests, 24/24 cumulative tests passing).

## Stage 5: Students
- **Status:** Completed
- **Components Built:**
  - `Student` database model in `backend/app/students/models.py` with `CourseType` enum (`GP_RATING`, `CCMS`, `ETO`, `DNS`, `BSC`, `CHHOTI_TRAINING`), JSON custom data, and relational links.
  - Automatic student number generation in format `STU-YYYY-XXXXXX` (e.g. `STU-2026-000001`) backed by sequence / atomic fallback.
  - Student CRUD service in `backend/app/students/service.py` with dynamic financial totals (`total_required`, `total_paid`, `total_due`).
  - Field-level audit diff logging on updates (logging only changed fields).
  - Employee delete prevention: Admin can delete students, while Employee delete attempts return HTTP 403 Forbidden.
  - Student routes in `backend/app/students/routes.py` with automatic `audit_view` dependency on `GET /api/students/{id}`.
  - Test suite in `backend/tests/test_students.py` (4 tests, 28/28 cumulative tests passing).

## Stage 6: Payments
- **Status:** Completed
- **Components Built:**
  - `Payment` database model in `backend/app/payments/models.py` with `PaymentMode` enum (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `CHEQUE`, `OTHER`), strict positive amount constraint, and mode-dependent `online_account` validation.
  - Calculated financial totals logic (total due = total required - sum of student payments, never stored).
  - Dedicated `/api/payments/students/{id}/totals` endpoint and student payment history listing.
  - Role-based permissions: Both Admin and Employee can record payments; only Admin can edit or delete payments, with unauthorized employee actions returning HTTP 403 Forbidden.
  - Full audit logging for payment creation, field-level edits, and deletions.
  - Integration test suite in `backend/tests/test_payments.py` (5 tests, 33/33 cumulative tests passing).

## Stage 7: Notifications
- **Status:** Completed
- **Components Built:**
  - `Notification` database model in `backend/app/notifications/models.py`.
  - Notification fan-out service: creates real-time alert notifications for all active administrators whenever an employee updates a student record, detailing field deltas.
  - Excluded admin self-edits and deactivated admins from fan-out notifications.
  - Endpoints in `backend/app/notifications/routes.py`:
    - `GET /api/notifications`: user-specific notification listing.
    - `GET /api/notifications/unread-count`: lightweight endpoint for client polling.
    - `PATCH /api/notifications/{id}/read`: single notification read mark.
    - `POST /api/notifications/read-all`: batch read mark for current user.
  - Test suite in `backend/tests/test_notifications.py` (3 tests, 36/36 cumulative tests passing).

## Stage 8: Frontend Application
- **Status:** Completed
- **Components Built:**
  - Modern, responsive React 18 + Vite + TypeScript web client in `frontend/src`.
  - Type-safe API client (`src/api/client.ts`) with credentials support and automatic 401 token refresh retry.
  - Authentication layer & route guards (`src/auth/AuthContext.tsx`): `RequireAuth` (redirects unauthenticated users to `/login`) and `RequireAdmin` (blocks employee access to admin routes).
  - Header & Layout (`src/components/Layout.tsx`) with 30-second polling for unread notifications, active unread counter badge, notification dropdown, and user role tags.
  - Login Page (`src/features/auth/LoginPage.tsx`) with Zod form validation and HTTP 429 rate limit detection.
  - Batches Directory & Creation (`src/features/batches/BatchesPage.tsx`).
  - Batch Detail & College Linking (`src/features/batches/BatchDetailPage.tsx`) with 409 conflict handling.
  - Colleges Page (`src/features/colleges/CollegesPage.tsx`) with deactivation controls and guaranteed no-delete policy.
  - Students Page (`src/features/students/StudentsPage.tsx`) with multi-criteria filtering, search, and enrolment modal.
  - Student Detail & Payment Panel (`src/features/students/StudentDetailPage.tsx`) showing live required/paid/due totals, payment history, employee/admin payment creation, and admin-exclusive edit/delete buttons.
  - Audit Log Viewer (`src/features/audit/AuditLogPage.tsx`) with action, entity type, entity ID, and user ID filters plus pagination.
  - Frontend Vitest suite (3 test files, 6 tests passing) verifying role guards and payment panel button permissions.

## Stage 9: Finalization & Verification
- **Status:** Completed
- **Components Built:**
  - Idempotent sample data seed script in `backend/app/core/sample_data.py` generating pre-configured administrator, employee, training batches, partner maritime colleges, enrolled students with sequenced identifiers, and verified payments.
  - Comprehensive documentation in `batch-crm/README.md` containing full architecture, permissions table, setup guides (Docker Compose and host virtual environment), testing commands, and pre-seeded credentials.

## Stage 10: Employee Management (Admin Only)
- **Status:** Completed
- **Components Built:**
  - Admin-only endpoints under `/admin/users` and `/api/admin/users`:
    - `GET /admin/users`: paginated user list with search by name/email, and filter by role and active status.
    - `POST /admin/users`: create user with argon2 password (min 8 chars) and email uniqueness check.
    - `PATCH /admin/users/{id}`: edit user name, email, and role.
    - `POST /admin/users/{id}/reset-password`: admin password reset with immediate session revocation.
    - `POST /admin/users/{id}/activate`: reactivate employee account.
    - `POST /admin/users/{id}/deactivate`: deactivate account and revoke all active refresh tokens.
    - `POST /admin/users/{id}/revoke-sessions`: revoke all active refresh tokens without deactivation.
  - Core Business Rules & Safeguards:
    - Users are never hard-deleted; deactivation is the sole mechanism to retire accounts.
    - Self-protection: Admins cannot deactivate, demote, or revoke their own sessions via `/admin/users` (HTTP 400).
    - Minimum active admin protection: System blocks any action leaving 0 active admins with HTTP 409 Conflict.
    - Full audit logging: Actions `user.create`, `user.update`, `user.password_reset`, `user.deactivate`, `user.activate`, and `user.session_revoke` recorded with field diffs.
  - Frontend "Employees" page (`src/features/employees/EmployeesPage.tsx`) in navigation, guarded by `RequireAdmin`, with search, filter, creation modal, edit modal, password reset modal, and action buttons.
  - Comprehensive test suite in `backend/tests/test_admin_users.py` (8 tests) and `frontend/src/test/employeesPage.test.tsx`.

## Stage 11: Profile & Display Name
- **Status:** Completed
- **Components Built:**
  - Added `display_name` (nullable string, max 100) to `User` model, with Alembic migration `2026_01_02_0002_add_display_name_to_user.py` defaulting existing records to null.
  - Added `actor_name` to `AuditLog` model and updated `audit_service.record` to capture `display_name` if present, falling back to `email`.
  - Endpoints under `/me` and `/api/me`:
    - `GET /me`: returns current user profile with `display_name`.
    - `PATCH /me`: updates `display_name` only; forbids modifying role, email, or active status (`extra="forbid"`). Records field diff audit entry.
    - `POST /me/change-password`: validates current password, validates new password (minimum 8 characters), updates password hash, revokes all other active sessions, and records audit entry.
  - Updated notification message builder (`fanout_employee_student_edit`) to display employee's `display_name` when set, otherwise `email`.
  - Frontend "Profile" page (`src/features/profile/ProfilePage.tsx`) accessible via header user menu:
    - Display name update form with live fallback preview.
    - Secure password change form with current password validation and mismatch checking.
  - Header user display and employee table updated to show `display_name` when available, falling back to email/name.
  - Comprehensive test suite in `backend/tests/test_profile.py` (5 tests) and `frontend/src/test/profilePage.test.tsx` (5 tests).

