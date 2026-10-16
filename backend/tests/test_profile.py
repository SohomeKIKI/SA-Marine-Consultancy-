import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole, RefreshToken
from app.audit.models import AuditLog
from app.batches.models import Batch, College, BatchCollege
from app.students.models import Student, CourseType
from app.notifications.models import Notification
from app.notifications.service import list_user_notifications


@pytest.fixture
def profile_test_setup(client, db_session):
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
    db_session.add_all([admin, employee])
    db_session.commit()

    # Login employee
    emp_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    emp_access_token = emp_login.cookies["access_token"]
    emp_refresh_token = emp_login.cookies["refresh_token"]

    # Login admin
    admin_login = client.post(
        "/api/iam/login",
        json={"email": "admin@test.com", "password": "AdminPass123!"},
    )
    admin_access_token = admin_login.cookies["access_token"]
    admin_refresh_token = admin_login.cookies["refresh_token"]

    return {
        "admin": admin,
        "employee": employee,
        "emp_access_token": emp_access_token,
        "emp_refresh_token": emp_refresh_token,
        "admin_access_token": admin_access_token,
        "admin_refresh_token": admin_refresh_token,
    }


def test_user_can_update_own_display_name(client, profile_test_setup, db_session):
    client.cookies.set("access_token", profile_test_setup["emp_access_token"])

    # GET /me
    resp = client.get("/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "employee@test.com"
    assert data["display_name"] is None

    # PATCH /me
    patch_resp = client.patch("/me", json={"display_name": "Special Agent Dana"})
    assert patch_resp.status_code == 200
    updated_data = patch_resp.json()
    assert updated_data["display_name"] == "Special Agent Dana"

    # Verify audit log was recorded
    audit_row = db_session.query(AuditLog).filter(
        AuditLog.action == "user.update",
        AuditLog.field == "display_name",
        AuditLog.new_value == "Special Agent Dana",
    ).first()
    assert audit_row is not None
    assert audit_row.old_value is None
    assert audit_row.actor_name == "Special Agent Dana"


def test_user_cannot_change_role_or_email_via_me(client, profile_test_setup, db_session):
    client.cookies.set("access_token", profile_test_setup["emp_access_token"])

    # Attempt to elevate role
    resp_role = client.patch("/me", json={"role": "admin"})
    assert resp_role.status_code == 422

    # Attempt to change email
    resp_email = client.patch("/me", json={"email": "hacked@test.com"})
    assert resp_email.status_code == 422

    # Attempt to change active status
    resp_active = client.patch("/me", json={"is_active": False})
    assert resp_active.status_code == 422

    # Verify employee record unchanged
    emp = db_session.get(User, profile_test_setup["employee"].id)
    assert emp is not None
    assert emp.role == UserRole.employee
    assert emp.email == "employee@test.com"
    assert emp.is_active is True


def test_change_password_validation_and_wrong_password(client, profile_test_setup):
    client.cookies.set("access_token", profile_test_setup["emp_access_token"])

    # Wrong current password
    resp_wrong = client.post(
        "/me/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewSecretPass123!"},
    )
    assert resp_wrong.status_code == 400
    assert "incorrect" in resp_wrong.json()["detail"].lower()

    # New password too short (< 8 chars)
    resp_short = client.post(
        "/me/change-password",
        json={"current_password": "EmployeePass123!", "new_password": "short"},
    )
    assert resp_short.status_code in (400, 422)


def test_password_change_revokes_other_sessions(client, profile_test_setup, db_session):
    # Session 1: emp_access_token, emp_refresh_token
    session1_refresh = profile_test_setup["emp_refresh_token"]

    # Create Session 2 for the same employee
    login2 = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    assert login2.status_code == 200
    session2_access = login2.cookies["access_token"]
    session2_refresh = login2.cookies["refresh_token"]

    # Both tokens exist in DB and are unrevoked
    active_tokens = db_session.query(RefreshToken).filter(
        RefreshToken.user_id == profile_test_setup["employee"].id,
        RefreshToken.revoked_at.is_(None),
    ).all()
    assert len(active_tokens) >= 2

    # Now change password using Session 1
    client.cookies.set("access_token", profile_test_setup["emp_access_token"])
    client.cookies.set("refresh_token", session1_refresh)

    change_resp = client.post(
        "/me/change-password",
        json={"current_password": "EmployeePass123!", "new_password": "BrandNewPassword123!"},
    )
    assert change_resp.status_code == 200

    # Session 1's refresh token should STILL be valid
    client.cookies.clear()
    refresh_resp1 = client.post(
        "/api/iam/refresh",
        cookies={"refresh_token": session1_refresh},
    )
    assert refresh_resp1.status_code == 200

    # Session 2 refresh token should now be revoked
    # Try refreshing using session 2's refresh token
    client.cookies.clear()
    refresh_resp2 = client.post(
        "/api/iam/refresh",
        cookies={"refresh_token": session2_refresh},
    )
    assert refresh_resp2.status_code == 401

    # Login with old password must fail
    old_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "EmployeePass123!"},
    )
    assert old_login.status_code == 401

    # Login with new password must succeed
    new_login = client.post(
        "/api/iam/login",
        json={"email": "employee@test.com", "password": "BrandNewPassword123!"},
    )
    assert new_login.status_code == 200


def test_display_name_appears_in_notification_message(client, profile_test_setup, db_session):
    employee = db_session.get(User, profile_test_setup["employee"].id)
    assert employee is not None
    employee.display_name = "Agent Mulder"
    db_session.commit()

    admin = profile_test_setup["admin"]

    batch = Batch(name="May 2026", month=5, year=2026, created_by=admin.id)
    college = College(name="Marine Academy", is_active=True, created_by=admin.id)
    db_session.add_all([batch, college])
    db_session.commit()

    link = BatchCollege(batch_id=batch.id, college_id=college.id, added_by=admin.id)
    db_session.add(link)
    db_session.commit()

    # Create a student
    student = Student(
        batch_college_id=link.id,
        student_number="STU-2026-000099",
        name="Dana Scully",
        course=CourseType.ETO,
        created_by=employee.id,
    )
    db_session.add(student)
    db_session.commit()
    db_session.refresh(student)

    # Employee edits student
    client.cookies.set("access_token", profile_test_setup["emp_access_token"])
    edit_resp = client.patch(
        f"/api/students/{student.id}",
        json={"course": "BSC"},
    )
    assert edit_resp.status_code == 200

    # Check notification for admin
    notifications = list_user_notifications(db_session, profile_test_setup["admin"].id)
    assert len(notifications) > 0
    latest_notif = notifications[0]
    assert "Agent Mulder edited student" in latest_notif.message
    assert "course changed from ETO to BSC" in latest_notif.message
