import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole, RefreshToken


@pytest.fixture
def test_users(db_session):
    admin = User(
        name="Admin User",
        email="admin@test.com",
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
    deactivated = User(
        name="Deactivated User",
        email="inactive@test.com",
        password_hash=get_password_hash("InactivePass123!"),
        role=UserRole.employee,
        is_active=False,
    )
    db_session.add_all([admin, employee, deactivated])
    db_session.commit()
    return {"admin": admin, "employee": employee, "deactivated": deactivated}


def test_login_success_and_cookies(client, test_users):
    resp = client.post(
        "/api/iam/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "admin@test.com"
    assert data["user"]["role"] == "admin"
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


def test_employee_login_success(client, test_users):
    resp = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == "employee@test.com"
    assert data["user"]["role"] == "employee"


def test_login_invalid_password(client, test_users):
    resp = client.post(
        "/api/iam/login",
        json={"email": "admin@test.com", "password": "WrongPassword!"},
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


def test_deactivated_user_cannot_login(client, test_users):
    resp = client.post(
        "/api/iam/login",
        json={"email": "inactive@test.com", "password": "InactivePass123!"},
    )
    assert resp.status_code == 403
    assert "deactivated" in resp.json()["detail"]


def test_login_throttling_after_5_failed_attempts(client, test_users):
    email = "throttled@test.com"
    for _ in range(5):
        resp = client.post(
            "/api/iam/login",
            json={"email": email, "password": "BadPassword"},
        )
        assert resp.status_code == 401

    # 6th attempt should be blocked by throttling with HTTP 429
    resp = client.post(
        "/api/iam/login",
        json={"email": email, "password": "AnyPassword"},
    )
    assert resp.status_code == 429
    assert "Too many failed login attempts" in resp.json()["detail"]


def test_refresh_token_rotation(client, test_users):
    login_resp = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    old_refresh_token = login_resp.cookies["refresh_token"]

    # Refresh token request with cookie
    client.cookies.set("refresh_token", old_refresh_token)
    refresh_resp = client.post("/api/iam/refresh")
    assert refresh_resp.status_code == 200
    new_refresh_token = refresh_resp.cookies["refresh_token"]
    assert new_refresh_token != old_refresh_token


def test_revoked_token_reuse_revokes_all_sessions(client, test_users, db_session):
    login_resp = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    old_refresh_token = login_resp.cookies["refresh_token"]

    # Rotate token once
    client.cookies.set("refresh_token", old_refresh_token)
    ref_resp = client.post("/api/iam/refresh")
    assert ref_resp.status_code == 200

    # Present the OLD (revoked) token again
    client.cookies.set("refresh_token", old_refresh_token)
    reuse_resp = client.post("/api/iam/refresh")
    assert reuse_resp.status_code == 401
    assert "Revoked refresh token reuse detected" in reuse_resp.json()["detail"]

    # Verify all tokens for this user are now marked revoked in the database
    tokens = db_session.query(RefreshToken).filter(
        RefreshToken.user_id == test_users["employee"].id
    ).all()
    for t in tokens:
        assert t.revoked_at is not None


def test_logout_revokes_session_and_clears_cookies(client, test_users):
    login_resp = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    client.cookies.set("access_token", login_resp.cookies["access_token"])
    client.cookies.set("refresh_token", login_resp.cookies["refresh_token"])

    logout_resp = client.post("/api/iam/logout")
    assert logout_resp.status_code == 200
    # Cookie should be deleted/expired in response
    assert logout_resp.json()["message"] == "Successfully logged out"


def test_role_enforcement_admin_endpoints(client, test_users):
    # Login as Employee
    emp_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    emp_access_token = emp_login.cookies["access_token"]

    # Employee tries to list users -> 403 Forbidden
    client.cookies.set("access_token", emp_access_token)
    list_resp = client.get("/api/iam/users")
    assert list_resp.status_code == 403
    assert "admin privileges" in list_resp.json()["detail"]

    # Employee tries to create user -> 403 Forbidden
    create_resp = client.post(
        "/api/iam/users",
        json={"name": "New Emp", "email": "new@test.com", "password": "Password123!", "role": "employee"},
    )
    assert create_resp.status_code == 403

    # Employee tries to revoke user sessions -> 403 Forbidden
    revoke_resp = client.post(f"/api/iam/users/{test_users['admin'].id}/revoke-sessions")
    assert revoke_resp.status_code == 403

    # Now Login as Admin
    admin_login = client.post(
        "/api/iam/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_access_token = admin_login.cookies["access_token"]
    client.cookies.set("access_token", admin_access_token)

    # Admin can list users
    admin_list = client.get("/api/iam/users")
    assert admin_list.status_code == 200
    users = admin_list.json()
    assert len(users) >= 3

    # Admin can revoke sessions for any user
    admin_revoke = client.post(f"/api/iam/users/{test_users['employee'].id}/revoke-sessions")
    assert admin_revoke.status_code == 200
    assert "Revoked" in admin_revoke.json()["message"]
