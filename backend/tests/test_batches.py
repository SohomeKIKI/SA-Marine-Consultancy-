import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole
from app.batches.models import Batch, College, BatchCollege
from app.students.models import Student, CourseType


@pytest.fixture
def auth_tokens(client, db_session):
    admin = User(
        name="Batch Admin",
        email="batchadmin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    employee = User(
        name="Batch Employee",
        email="batchemp@test.com",
        password_hash=get_password_hash("EmpPass123!"),
        role=UserRole.employee,
        is_active=True,
    )
    db_session.add_all([admin, employee])
    db_session.commit()

    admin_login = client.post("/api/iam/login", json={"email": "batchadmin@test.com", "password": "AdminPass123!"})
    emp_login = client.post("/api/iam/login", json={"email": "batchemp@test.com", "password": "EmpPass123!"})

    return {
        "admin_cookie": admin_login.cookies["access_token"],
        "emp_cookie": emp_login.cookies["access_token"],
        "admin_id": admin.id,
        "emp_id": employee.id,
    }


def test_batch_creation_and_naming(client, auth_tokens):
    client.cookies.set("access_token", auth_tokens["admin_cookie"])
    resp = client.post("/api/batches", json={"month": 1, "year": 2026})
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "January 2026"
    assert data["month"] == 1
    assert data["year"] == 2026

    # Duplicate check
    dup_resp = client.post("/api/batches", json={"month": 1, "year": 2026})
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"]


def test_employee_cannot_create_batch(client, auth_tokens):
    client.cookies.set("access_token", auth_tokens["emp_cookie"])
    resp = client.post("/api/batches", json={"month": 2, "year": 2026})
    assert resp.status_code == 403
    assert "admin privileges" in resp.json()["detail"]


def test_both_roles_can_view_batches(client, auth_tokens):
    # Admin view
    client.cookies.set("access_token", auth_tokens["admin_cookie"])
    admin_resp = client.get("/api/batches")
    assert admin_resp.status_code == 200

    # Employee view
    client.cookies.set("access_token", auth_tokens["emp_cookie"])
    emp_resp = client.get("/api/batches")
    assert emp_resp.status_code == 200


def test_college_creation_and_deactivation(client, auth_tokens):
    # Admin creates college
    client.cookies.set("access_token", auth_tokens["admin_cookie"])
    create_resp = client.post("/api/colleges", json={"name": "Maritime Academy Mumbai"})
    assert create_resp.status_code == 201
    college_id = create_resp.json()["id"]
    assert create_resp.json()["is_active"] is True

    # Employee cannot create college
    client.cookies.set("access_token", auth_tokens["emp_cookie"])
    emp_create = client.post("/api/colleges", json={"name": "Another College"})
    assert emp_create.status_code == 403

    # Employee cannot deactivate college
    emp_deact = client.patch(f"/api/colleges/{college_id}/deactivate")
    assert emp_deact.status_code == 403

    # Admin deactivates college
    client.cookies.set("access_token", auth_tokens["admin_cookie"])
    deact_resp = client.patch(f"/api/colleges/{college_id}/deactivate")
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False


def test_deactivated_college_cannot_be_linked_to_new_batch(client, auth_tokens):
    client.cookies.set("access_token", auth_tokens["admin_cookie"])

    # Create batch & college
    b_resp = client.post("/api/batches", json={"month": 3, "year": 2026})
    batch_id = b_resp.json()["id"]

    c_resp = client.post("/api/colleges", json={"name": "Goa Institute"})
    college_id = c_resp.json()["id"]

    # Deactivate college
    client.patch(f"/api/colleges/{college_id}/deactivate")

    # Attempt to link deactivated college
    link_resp = client.post(f"/api/batches/{batch_id}/colleges", json={"college_id": college_id})
    assert link_resp.status_code == 400
    assert "Cannot link a deactivated college" in link_resp.json()["detail"]


def test_college_never_deleted_rule(client, auth_tokens):
    client.cookies.set("access_token", auth_tokens["admin_cookie"])
    # Verify no DELETE route exists on colleges endpoint (should be 405 Method Not Allowed or 404)
    del_resp = client.delete("/api/colleges/1")
    assert del_resp.status_code in [404, 405]


def test_link_and_unlink_college_with_409_student_conflict_block(client, auth_tokens, db_session):
    client.cookies.set("access_token", auth_tokens["admin_cookie"])

    # Create batch and college
    b_resp = client.post("/api/batches", json={"month": 4, "year": 2026})
    batch_id = b_resp.json()["id"]

    c_resp = client.post("/api/colleges", json={"name": "Chennai Maritime"})
    college_id = c_resp.json()["id"]

    # Employee cannot link college
    client.cookies.set("access_token", auth_tokens["emp_cookie"])
    emp_link = client.post(f"/api/batches/{batch_id}/colleges", json={"college_id": college_id})
    assert emp_link.status_code == 403

    # Admin links college
    client.cookies.set("access_token", auth_tokens["admin_cookie"])
    link_resp = client.post(f"/api/batches/{batch_id}/colleges", json={"college_id": college_id})
    assert link_resp.status_code == 201

    # Fetch batch details to get batch_college_id
    detail_resp = client.get(f"/api/batches/{batch_id}")
    assert detail_resp.status_code == 200
    linked_colleges = detail_resp.json()["colleges"]
    assert len(linked_colleges) == 1
    batch_college_id = linked_colleges[0]["id"]

    # Add 2 students directly linked to this batch_college_id
    stu1 = Student(
        batch_college_id=batch_college_id,
        student_number="STU-2026-000001",
        name="Rahul Verma",
        course=CourseType.GP_RATING,
        total_required=150000.00,
        custom_data={},
        created_by=auth_tokens["admin_id"],
    )
    stu2 = Student(
        batch_college_id=batch_college_id,
        student_number="STU-2026-000002",
        name="Amit Patel",
        course=CourseType.DNS,
        total_required=200000.00,
        custom_data={},
        created_by=auth_tokens["admin_id"],
    )
    db_session.add_all([stu1, stu2])
    db_session.commit()

    # Now attempt to unlink college as Admin -> MUST return HTTP 409 Conflict with count
    unlink_conflict = client.delete(f"/api/batches/{batch_id}/colleges/{college_id}")
    assert unlink_conflict.status_code == 409
    detail_msg = unlink_conflict.json()["detail"]
    assert "2 student(s) currently enrolled" in detail_msg

    # Delete the students to test clean unlink
    db_session.delete(stu1)
    db_session.delete(stu2)
    db_session.commit()

    # Attempt unlink again -> Now succeeds
    clean_unlink = client.delete(f"/api/batches/{batch_id}/colleges/{college_id}")
    assert clean_unlink.status_code == 200
    assert "successfully unlinked" in clean_unlink.json()["message"]
