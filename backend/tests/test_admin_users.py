import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole, RefreshToken
from app.audit.models import AuditLog
from app.admin.schemas import AdminUserUpdateRequest


@pytest.fixture
def auth_setup(client, db_session):
    admin = User(
        name="Admin User",
        email="admin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    second_admin = User(
        name="Second Admin",
        email="second_admin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    employee = User(
        name="Employee User",
        email="employee@test.com",
        password_hash=get_password_hash("EmployeePass123!"),
        role=UserRole.employee,
        is_active=True,
    )
    db_session.add_all([admin, second_admin, employee])
    db_session.commit()

    # Login admin to obtain access token
    admin_login = client.post(
        "/api/iam/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_token = admin_login.cookies["access_token"]

    # Login employee to obtain access token
    emp_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    emp_token = emp_login.cookies["access_token"]

    return {
        "admin": admin,
        "second_admin": second_admin,
        "employee": employee,
        "admin_token": admin_token,
        "emp_token": emp_token,
    }


def test_employee_gets_403_on_all_admin_endpoints(client, auth_setup):
    client.cookies.set("access_token", auth_setup["emp_token"])

    # GET /admin/users
    resp = client.get("/admin/users")
    assert resp.status_code == 403

    # POST /admin/users
    resp = client.post(
        "/admin/users",
        json={"name": "Test", "email": "test@test.com", "role": "employee", "password": "Password123!"},
    )
    assert resp.status_code == 403

    # PATCH /admin/users/{id}
    resp = client.patch(f"/admin/users/{auth_setup['employee'].id}", json={"name": "Updated"})
    assert resp.status_code == 403

    # POST /admin/users/{id}/reset-password
    resp = client.post(f"/admin/users/{auth_setup['employee'].id}/reset-password", json={"password": "NewPassword123!"})
    assert resp.status_code == 403

    # POST /admin/users/{id}/deactivate
    resp = client.post(f"/admin/users/{auth_setup['employee'].id}/deactivate")
    assert resp.status_code == 403

    # POST /admin/users/{id}/activate
    resp = client.post(f"/admin/users/{auth_setup['employee'].id}/activate")
    assert resp.status_code == 403

    # POST /admin/users/{id}/revoke-sessions
    resp = client.post(f"/admin/users/{auth_setup['employee'].id}/revoke-sessions")
    assert resp.status_code == 403


def test_admin_create_user_and_validation(client, auth_setup, db_session):
    client.cookies.set("access_token", auth_setup["admin_token"])

    # Password too short (< 8 chars)
    short_pw = client.post(
        "/admin/users",
        json={"name": "Short Pw", "email": "short@test.com", "role": "employee", "password": "short"},
    )
    assert short_pw.status_code == 422

    # Success creation
    create_resp = client.post(
        "/admin/users",
        json={"name": "Rohan Patel", "email": "rohan@test.com", "role": "employee", "password": "ValidPassword123!"},
    )
    assert create_resp.status_code == 201
    created_user = create_resp.json()
    assert created_user["name"] == "Rohan Patel"
    assert created_user["email"] == "rohan@test.com"
    assert created_user["role"] == "employee"
    assert created_user["is_active"] is True
    assert "password" not in created_user
    assert "password_hash" not in created_user

    # Duplicate email rejected
    dup_resp = client.post(
        "/admin/users",
        json={"name": "Another", "email": "rohan@test.com", "role": "employee", "password": "ValidPassword123!"},
    )
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"]

    # Audit row verified
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "user.create",
        AuditLog.entity_id == str(created_user["id"]),
    ).first()
    assert audit is not None
    assert audit.user_id == auth_setup["admin"].id


def test_admin_edit_user(client, auth_setup, db_session):
    client.cookies.set("access_token", auth_setup["admin_token"])
    target_id = auth_setup["employee"].id

    # Edit name, email, role
    edit_resp = client.patch(
        f"/admin/users/{target_id}",
        json={"name": "Employee Updated", "email": "employee_updated@test.com", "role": "admin"},
    )
    assert edit_resp.status_code == 200
    data = edit_resp.json()
    assert data["name"] == "Employee Updated"
    assert data["email"] == "employee_updated@test.com"
    assert data["role"] == "admin"

    # Duplicate email check
    dup_resp = client.patch(
        f"/admin/users/{target_id}",
        json={"email": "admin@test.com"},
    )
    assert dup_resp.status_code == 400

    # Verify audit row created
    audits = db_session.query(AuditLog).filter(
        AuditLog.action == "user.update",
        AuditLog.entity_id == str(target_id),
    ).all()
    assert len(audits) >= 1


def test_admin_reset_password_revokes_tokens(client, auth_setup, db_session):
    # Log in employee to create a refresh token
    emp_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    old_refresh_token = emp_login.cookies["refresh_token"]

    # Admin resets employee password
    client.cookies.set("access_token", auth_setup["admin_token"])
    reset_resp = client.post(
        f"/admin/users/{auth_setup['employee'].id}/reset-password",
        json={"password": "NewSecurePassword123!"},
    )
    assert reset_resp.status_code == 200
    assert "Password reset successfully" in reset_resp.json()["message"]

    # Old password fails
    bad_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    assert bad_login.status_code == 401

    # New password succeeds
    good_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "NewSecurePassword123!"},
    )
    assert good_login.status_code == 200

    # Old refresh token is revoked
    client.cookies.set("refresh_token", old_refresh_token)
    ref_resp = client.post("/api/iam/refresh")
    assert ref_resp.status_code == 401

    # Audit row
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "user.password_reset",
        AuditLog.entity_id == str(auth_setup["employee"].id),
    ).first()
    assert audit is not None


def test_admin_deactivate_and_activate(client, auth_setup, db_session):
    emp_id = auth_setup["employee"].id

    # Log in employee to get refresh token
    login_resp = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    emp_refresh_token = login_resp.cookies["refresh_token"]

    # Admin deactivates employee
    client.cookies.set("access_token", auth_setup["admin_token"])
    deact_resp = client.post(f"/admin/users/{emp_id}/deactivate")
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False

    # Deactivated user cannot login
    cannot_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    assert cannot_login.status_code == 403
    assert "deactivated" in cannot_login.json()["detail"]

    # Existing refresh token is revoked
    client.cookies.set("refresh_token", emp_refresh_token)
    ref_resp = client.post("/api/iam/refresh")
    assert ref_resp.status_code == 401

    # Admin reactivates employee
    client.cookies.set("access_token", auth_setup["admin_token"])
    act_resp = client.post(f"/admin/users/{emp_id}/activate")
    assert act_resp.status_code == 200
    assert act_resp.json()["is_active"] is True

    # User can log in again
    can_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    assert can_login.status_code == 200

    # Audit records
    deact_audit = db_session.query(AuditLog).filter(
        AuditLog.action == "user.deactivate",
        AuditLog.entity_id == str(emp_id),
    ).first()
    assert deact_audit is not None

    act_audit = db_session.query(AuditLog).filter(
        AuditLog.action == "user.activate",
        AuditLog.entity_id == str(emp_id),
    ).first()
    assert act_audit is not None


def test_last_active_admin_protection(client, auth_setup, db_session):
    from fastapi import HTTPException
    from app.admin import service

    # Admin 1 deactivates second admin
    client.cookies.set("access_token", auth_setup["admin_token"])
    client.post(f"/admin/users/{auth_setup['second_admin'].id}/deactivate")

    # Now only Admin 1 is active.
    # An attempt to deactivate the last active admin raises 409 Conflict
    fake_caller = User(id=999, role=UserRole.admin, is_active=True)
    with pytest.raises(HTTPException) as exc_info:
        service.deactivate_user(db_session, auth_setup["admin"].id, current_user=fake_caller)
    assert exc_info.value.status_code == 409
    assert "Cannot deactivate the last active administrator" in exc_info.value.detail

    # An attempt to demote the last active admin raises 409 Conflict
    with pytest.raises(HTTPException) as exc_info:
        service.update_user(
            db_session,
            auth_setup["admin"].id,
            AdminUserUpdateRequest(role=UserRole.employee),
            current_user=fake_caller,
        )
    assert exc_info.value.status_code == 409
    assert "Cannot demote the last active administrator" in exc_info.value.detail


def test_admin_cannot_deactivate_demote_or_revoke_self(client, auth_setup):
    client.cookies.set("access_token", auth_setup["admin_token"])
    admin_id = auth_setup["admin"].id

    # Deactivate self
    deact_resp = client.post(f"/admin/users/{admin_id}/deactivate")
    assert deact_resp.status_code == 400
    assert "cannot deactivate their own account" in deact_resp.json()["detail"]

    # Demote self
    demote_resp = client.patch(f"/admin/users/{admin_id}", json={"role": "employee"})
    assert demote_resp.status_code == 400
    assert "cannot change or demote their own role" in demote_resp.json()["detail"]

    # Revoke self sessions
    revoke_resp = client.post(f"/admin/users/{admin_id}/revoke-sessions")
    assert revoke_resp.status_code == 400
    assert "cannot revoke their own sessions" in revoke_resp.json()["detail"]


def test_admin_list_users_search_filter_pagination(client, auth_setup):
    client.cookies.set("access_token", auth_setup["admin_token"])

    # List all
    all_resp = client.get("/admin/users")
    assert all_resp.status_code == 200
    data = all_resp.json()
    assert data["total"] >= 3
    assert len(data["items"]) >= 3

    # Filter by role
    emp_resp = client.get("/admin/users?role=employee")
    assert emp_resp.status_code == 200
    assert all(u["role"] == "employee" for u in emp_resp.json()["items"])

    # Filter by search
    search_resp = client.get("/admin/users?search=second")
    assert search_resp.status_code == 200
    assert len(search_resp.json()["items"]) == 1
    assert search_resp.json()["items"][0]["email"] == "second_admin@test.com"

    # Filter by active status
    active_resp = client.get("/admin/users?is_active=true")
    assert active_resp.status_code == 200
    assert all(u["is_active"] is True for u in active_resp.json()["items"])
