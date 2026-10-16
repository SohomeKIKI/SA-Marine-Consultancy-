import inspect
import pytest
from app.audit import service as audit_service
from app.core.security import get_password_hash
from app.iam.models import User, UserRole
from app.audit.models import AuditLog


@pytest.fixture
def test_users_audit(db_session):
    admin = User(
        name="Audit Admin",
        email="auditadmin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    employee = User(
        name="Audit Employee",
        email="auditemp@test.com",
        password_hash=get_password_hash("EmpPass123!"),
        role=UserRole.employee,
        is_active=True,
    )
    db_session.add_all([admin, employee])
    db_session.commit()
    return {"admin": admin, "employee": employee}


def test_audit_service_immutability():
    """Verify that audit service provides NO update or delete functions."""
    methods = [
        name for name, _ in inspect.getmembers(audit_service, inspect.isfunction)
    ]
    for m in methods:
        assert "update" not in m.lower(), f"Forbidden update method in audit service: {m}"
        assert "delete" not in m.lower(), f"Forbidden delete method in audit service: {m}"


def test_audit_record_field_changes(db_session, test_users_audit):
    admin = test_users_audit["admin"]

    # Multiple fields: 1 changed, 1 unchanged
    changes = {
        "course": ("ETO", "BSC"),
        "agent_name": ("Direct", "Direct"),  # unchanged
    }
    logs = audit_service.record(
        db=db_session,
        user=admin,
        action="update",
        entity_type="student",
        entity_id="12",
        changes=changes,
    )
    db_session.commit()

    assert len(logs) == 1
    assert logs[0].field == "course"
    assert logs[0].old_value == "ETO"
    assert logs[0].new_value == "BSC"

    # No changes
    no_change = {"course": ("BSC", "BSC")}
    empty_logs = audit_service.record(
        db=db_session,
        user=admin,
        action="update",
        entity_type="student",
        entity_id="12",
        changes=no_change,
    )
    db_session.commit()
    assert len(empty_logs) == 0


def test_audit_transaction_rollback(db_session, test_users_audit):
    admin = test_users_audit["admin"]
    try:
        audit_service.record(
            db=db_session,
            user=admin,
            action="create",
            entity_type="test",
            entity_id="999",
        )
        # Simulate a transaction failure
        raise ValueError("Simulated database failure")
    except ValueError:
        db_session.rollback()

    # Verify no log was persisted
    persisted = db_session.query(AuditLog).filter(AuditLog.entity_id == "999").first()
    assert persisted is None


def test_admin_audit_log_endpoint_and_filters(client, test_users_audit, db_session):
    admin = test_users_audit["admin"]

    # Create several audit logs
    audit_service.record(db_session, admin, "create", "student", "101")
    audit_service.record(db_session, admin, "delete", "student", "102")
    audit_service.record(db_session, admin, "create", "college", "5")
    db_session.commit()

    # Login as admin
    login_resp = client.post(
        "/api/iam/login",
        json={"email": "auditadmin@test.com", "password": "AdminPass123!"},
    )
    token = login_resp.cookies["access_token"]
    client.cookies.set("access_token", token)

    # Test all logs
    resp = client.get("/api/audit/logs")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 3

    # Filter by entity_type
    filter_resp = client.get("/api/audit/logs?entity_type=college")
    assert filter_resp.status_code == 200
    college_data = filter_resp.json()
    assert college_data["total"] >= 1
    assert all(item["entity_type"] == "college" for item in college_data["items"])

    # Filter by action
    action_resp = client.get("/api/audit/logs?action=delete")
    assert action_resp.status_code == 200
    del_data = action_resp.json()
    assert all(item["action"] == "delete" for item in del_data["items"])


def test_employee_cannot_view_audit_logs(client, test_users_audit):
    # Login as employee
    login_resp = client.post(
        "/api/iam/login",
        json={"email": "auditemp@test.com", "password": "EmpPass123!"},
    )
    token = login_resp.cookies["access_token"]
    client.cookies.set("access_token", token)

    # Request audit logs
    resp = client.get("/api/audit/logs")
    assert resp.status_code == 403
    assert "admin privileges" in resp.json()["detail"]
