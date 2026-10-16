from decimal import Decimal
import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole
from app.batches.models import Batch, College, BatchCollege
from app.students.models import Student, CourseType
from app.payments.models import Payment, PaymentMode
from app.audit.models import AuditLog


@pytest.fixture
def payment_test_setup(client, db_session):
    admin = User(
        name="Pay Admin",
        email="payadmin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    employee = User(
        name="Pay Employee",
        email="payemp@test.com",
        password_hash=get_password_hash("EmpPass123!"),
        role=UserRole.employee,
        is_active=True,
    )
    db_session.add_all([admin, employee])
    db_session.commit()

    batch = Batch(name="June 2026", month=6, year=2026, created_by=admin.id)
    college = College(name="Delhi Maritime", is_active=True, created_by=admin.id)
    db_session.add_all([batch, college])
    db_session.commit()

    link = BatchCollege(batch_id=batch.id, college_id=college.id, added_by=admin.id)
    db_session.add(link)
    db_session.commit()

    student = Student(
        batch_college_id=link.id,
        student_number="STU-2026-000100",
        name="Ankit Sharma",
        course=CourseType.DNS,
        total_required=Decimal("250000.00"),
        custom_data={},
        created_by=admin.id,
    )
    db_session.add(student)
    db_session.commit()

    admin_login = client.post("/api/iam/login", json={"email": "payadmin@test.com", "password": "AdminPass123!"})
    emp_login = client.post("/api/iam/login", json={"email": "payemp@test.com", "password": "EmpPass123!"})

    return {
        "admin_cookie": admin_login.cookies["access_token"],
        "emp_cookie": emp_login.cookies["access_token"],
        "student_id": student.id,
    }


def test_add_payment_both_roles(client, payment_test_setup):
    # Employee adds cash payment
    client.cookies.set("access_token", payment_test_setup["emp_cookie"])
    p1 = client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 50000.00,
            "mode": "CASH",
        },
    )
    assert p1.status_code == 201
    assert p1.json()["amount"] == "50000.00"

    # Admin adds UPI payment with online account
    client.cookies.set("access_token", payment_test_setup["admin_cookie"])
    p2 = client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 100000.00,
            "mode": "UPI",
            "online_account": "hdfc_merchant_upi",
        },
    )
    assert p2.status_code == 201


def test_payment_validation_amount_and_online_account(client, payment_test_setup):
    client.cookies.set("access_token", payment_test_setup["emp_cookie"])

    # Non-positive amount rejected
    neg_p = client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 0,
            "mode": "CASH",
        },
    )
    assert neg_p.status_code == 422

    # UPI without online_account rejected
    upi_fail = client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 10000.00,
            "mode": "UPI",
            "online_account": "",
        },
    )
    assert upi_fail.status_code == 422


def test_student_totals_calculation(client, payment_test_setup):
    client.cookies.set("access_token", payment_test_setup["admin_cookie"])

    # Total required is 250,000. Add two payments: 70,000 and 80,000 (total paid = 150,000; due = 100,000)
    client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 70000.00,
            "mode": "BANK_TRANSFER",
            "online_account": "ICICI_CURRENT_001",
        },
    )
    client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 80000.00,
            "mode": "CARD",
            "online_account": "POS_TERMINAL_2",
        },
    )

    totals_resp = client.get(f"/api/payments/students/{payment_test_setup['student_id']}/totals")
    assert totals_resp.status_code == 200
    totals = totals_resp.json()
    assert totals["total_required"] == "250000.00"
    assert totals["total_paid"] == "150000.00"
    assert totals["total_due"] == "100000.00"


def test_edit_payment_permissions_and_audit(client, payment_test_setup, db_session):
    client.cookies.set("access_token", payment_test_setup["admin_cookie"])
    pay_resp = client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 25000.00,
            "mode": "CASH",
        },
    )
    pay_id = pay_resp.json()["id"]

    # Employee tries to edit payment -> 403 Forbidden
    client.cookies.set("access_token", payment_test_setup["emp_cookie"])
    emp_edit = client.patch(f"/api/payments/{pay_id}", json={"amount": 30000.00})
    assert emp_edit.status_code == 403
    assert "admin privileges" in emp_edit.json()["detail"]

    # Admin edits payment -> 200 OK
    client.cookies.set("access_token", payment_test_setup["admin_cookie"])
    admin_edit = client.patch(f"/api/payments/{pay_id}", json={"amount": 35000.00})
    assert admin_edit.status_code == 200
    assert admin_edit.json()["amount"] == "35000.00"

    # Verify audit log recorded change
    audit_row = db_session.query(AuditLog).filter(
        AuditLog.action == "update",
        AuditLog.entity_type == "payment",
        AuditLog.entity_id == str(pay_id),
        AuditLog.field == "amount",
    ).first()
    assert audit_row is not None
    assert "25000" in audit_row.old_value
    assert "35000" in audit_row.new_value


def test_delete_payment_permissions_and_audit(client, payment_test_setup, db_session):
    client.cookies.set("access_token", payment_test_setup["admin_cookie"])
    pay_resp = client.post(
        "/api/payments",
        json={
            "student_id": payment_test_setup["student_id"],
            "amount": 12000.00,
            "mode": "CASH",
        },
    )
    pay_id = pay_resp.json()["id"]

    # Employee tries to delete -> 403 Forbidden
    client.cookies.set("access_token", payment_test_setup["emp_cookie"])
    emp_del = client.delete(f"/api/payments/{pay_id}")
    assert emp_del.status_code == 403

    # Admin deletes -> 200 OK
    client.cookies.set("access_token", payment_test_setup["admin_cookie"])
    admin_del = client.delete(f"/api/payments/{pay_id}")
    assert admin_del.status_code == 200

    # Payment no longer exists
    assert db_session.get(Payment, pay_id) is None

    # Audit record exists
    del_audit = db_session.query(AuditLog).filter(
        AuditLog.action == "delete",
        AuditLog.entity_type == "payment",
        AuditLog.entity_id == str(pay_id),
    ).first()
    assert del_audit is not None
