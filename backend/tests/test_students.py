import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole
from app.batches.models import Batch, College, BatchCollege
from app.students.models import Student, CourseType
from app.audit.models import AuditLog


@pytest.fixture
def student_test_setup(client, db_session):
    admin = User(
        name="Student Admin",
        email="stuadmin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    employee = User(
        name="Student Employee",
        email="stuemp@test.com",
        password_hash=get_password_hash("EmpPass123!"),
        role=UserRole.employee,
        is_active=True,
    )
    db_session.add_all([admin, employee])
    db_session.commit()

    batch = Batch(name="May 2026", month=5, year=2026, created_by=admin.id)
    college = College(name="Kolkata Marine College", is_active=True, created_by=admin.id)
    db_session.add_all([batch, college])
    db_session.commit()

    link = BatchCollege(batch_id=batch.id, college_id=college.id, added_by=admin.id)
    db_session.add(link)
    db_session.commit()

    admin_login = client.post("/api/iam/login", json={"email": "stuadmin@test.com", "password": "AdminPass123!"})
    emp_login = client.post("/api/iam/login", json={"email": "stuemp@test.com", "password": "EmpPass123!"})

    return {
        "admin_cookie": admin_login.cookies["access_token"],
        "emp_cookie": emp_login.cookies["access_token"],
        "admin_id": admin.id,
        "emp_id": employee.id,
        "batch_college_id": link.id,
    }


def test_create_student_by_employee_and_auto_number(client, student_test_setup):
    # Employee creates student
    client.cookies.set("access_token", student_test_setup["emp_cookie"])
    resp = client.post(
        "/api/students",
        json={
            "batch_college_id": student_test_setup["batch_college_id"],
            "name": "Siddharth Roy",
            "course": "ETO",
            "agent_name": "Direct Agent",
            "total_required": 180000.00,
            "custom_data": {"passport": "P1234567"},
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Siddharth Roy"
    assert data["course"] == "ETO"
    assert data["student_number"].startswith("STU-2026-")
    assert data["total_required"] == "180000.00"
    assert data["total_paid"] == "0.00"
    assert data["total_due"] == "180000.00"


def test_view_student_triggers_audit_log(client, student_test_setup, db_session):
    # Create student
    client.cookies.set("access_token", student_test_setup["admin_cookie"])
    create_resp = client.post(
        "/api/students",
        json={
            "batch_college_id": student_test_setup["batch_college_id"],
            "name": "Deepak Kumar",
            "course": "GP_RATING",
            "total_required": 120000.00,
        },
    )
    stu_id = create_resp.json()["id"]

    # View student as employee
    client.cookies.set("access_token", student_test_setup["emp_cookie"])
    view_resp = client.get(f"/api/students/{stu_id}")
    assert view_resp.status_code == 200

    # Verify view audit log was inserted
    view_log = db_session.query(AuditLog).filter(
        AuditLog.action == "view",
        AuditLog.entity_type == "student",
        AuditLog.entity_id == str(stu_id),
    ).first()
    assert view_log is not None
    assert view_log.user_id == student_test_setup["emp_id"]


def test_edit_student_field_level_audit_logging(client, student_test_setup, db_session):
    client.cookies.set("access_token", student_test_setup["admin_cookie"])
    create_resp = client.post(
        "/api/students",
        json={
            "batch_college_id": student_test_setup["batch_college_id"],
            "name": "Priya Sharma",
            "course": "ETO",
            "total_required": 200000.00,
        },
    )
    stu_id = create_resp.json()["id"]

    # Employee edits course from ETO to BSC, and name remains unchanged
    client.cookies.set("access_token", student_test_setup["emp_cookie"])
    edit_resp = client.patch(
        f"/api/students/{stu_id}",
        json={"course": "BSC"},
    )
    assert edit_resp.status_code == 200
    assert edit_resp.json()["course"] == "BSC"

    # Verify audit log recorded exact field-level diff
    logs = db_session.query(AuditLog).filter(
        AuditLog.action == "update",
        AuditLog.entity_type == "student",
        AuditLog.entity_id == str(stu_id),
    ).all()

    course_log = [l for l in logs if l.field == "course"]
    assert len(course_log) == 1
    assert course_log[0].old_value == "ETO"
    assert course_log[0].new_value == "BSC"


def test_employee_cannot_delete_student_admin_can(client, student_test_setup, db_session):
    client.cookies.set("access_token", student_test_setup["admin_cookie"])
    create_resp = client.post(
        "/api/students",
        json={
            "batch_college_id": student_test_setup["batch_college_id"],
            "name": "ToDelete Student",
            "course": "CCMS",
            "total_required": 95000.00,
        },
    )
    stu_id = create_resp.json()["id"]

    # Employee attempts delete -> 403 Forbidden
    client.cookies.set("access_token", student_test_setup["emp_cookie"])
    emp_del = client.delete(f"/api/students/{stu_id}")
    assert emp_del.status_code == 403
    assert "admin privileges" in emp_del.json()["detail"]

    # Student still exists
    assert db_session.get(Student, stu_id) is not None

    # Admin deletes -> 200 OK
    client.cookies.set("access_token", student_test_setup["admin_cookie"])
    admin_del = client.delete(f"/api/students/{stu_id}")
    assert admin_del.status_code == 200
    assert "successfully deleted" in admin_del.json()["message"]

    # Student no longer exists
    assert db_session.get(Student, stu_id) is None
