from decimal import Decimal
import pytest
from app.core.security import get_password_hash
from app.iam.models import User, UserRole
from app.batches.models import Batch, College, BatchCollege
from app.students.models import Student, CourseType
from app.notifications.models import Notification


@pytest.fixture
def notif_test_setup(client, db_session):
    admin1 = User(
        name="Admin One",
        email="admin1@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    admin2 = User(
        name="Admin Two",
        email="admin2@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=True,
    )
    inactive_admin = User(
        name="Inactive Admin",
        email="inactadmin@test.com",
        password_hash=get_password_hash("AdminPass123!"),
        role=UserRole.admin,
        is_active=False,
    )
    employee = User(
        name="Priya",
        display_name="Priya",
        email="priya@test.com",
        password_hash=get_password_hash("PriyaPass123!"),
        role=UserRole.employee,
        is_active=True,
    )
    db_session.add_all([admin1, admin2, inactive_admin, employee])
    db_session.commit()

    batch = Batch(name="July 2026", month=7, year=2026, created_by=admin1.id)
    college = College(name="Kochi Marine", is_active=True, created_by=admin1.id)
    db_session.add_all([batch, college])
    db_session.commit()

    link = BatchCollege(batch_id=batch.id, college_id=college.id, added_by=admin1.id)
    db_session.add(link)
    db_session.commit()

    student = Student(
        batch_college_id=link.id,
        student_number="STU-2026-000012",
        name="Vikas Singh",
        course=CourseType.ETO,
        total_required=Decimal("200000.00"),
        custom_data={},
        created_by=admin1.id,
    )
    db_session.add(student)
    db_session.commit()

    a1_login = client.post("/api/iam/login", json={"email": "admin1@test.com", "password": "AdminPass123!"})
    a2_login = client.post("/api/iam/login", json={"email": "admin2@test.com", "password": "AdminPass123!"})
    emp_login = client.post("/api/iam/login", json={"email": "priya@test.com", "password": "PriyaPass123!"})

    return {
        "admin1_cookie": a1_login.cookies["access_token"],
        "admin2_cookie": a2_login.cookies["access_token"],
        "emp_cookie": emp_login.cookies["access_token"],
        "admin1_id": admin1.id,
        "admin2_id": admin2.id,
        "inactive_admin_id": inactive_admin.id,
        "student_id": student.id,
    }


def test_notification_fanout_on_employee_student_edit(client, notif_test_setup, db_session):
    # Employee Priya edits student course from ETO to BSC
    client.cookies.set("access_token", notif_test_setup["emp_cookie"])
    edit_resp = client.patch(
        f"/api/students/{notif_test_setup['student_id']}",
        json={"course": "BSC"},
    )
    assert edit_resp.status_code == 200

    # Both active admins should have received a notification
    a1_notifs = db_session.query(Notification).filter(
        Notification.recipient_id == notif_test_setup["admin1_id"]
    ).all()
    a2_notifs = db_session.query(Notification).filter(
        Notification.recipient_id == notif_test_setup["admin2_id"]
    ).all()

    assert len(a1_notifs) == 1
    assert len(a2_notifs) == 1

    expected_msg_fragment = "Priya edited student STU-2026-000012: course changed from ETO to BSC"
    assert expected_msg_fragment in a1_notifs[0].message
    assert a1_notifs[0].is_read is False

    # Inactive admin should NOT have received notification
    inact_notifs = db_session.query(Notification).filter(
        Notification.recipient_id == notif_test_setup["inactive_admin_id"]
    ).all()
    assert len(inact_notifs) == 0


def test_admin_edit_does_not_trigger_notification(client, notif_test_setup, db_session):
    # Admin edits student name
    client.cookies.set("access_token", notif_test_setup["admin1_cookie"])
    resp = client.patch(
        f"/api/students/{notif_test_setup['student_id']}",
        json={"name": "Vikas Kumar Singh"},
    )
    assert resp.status_code == 200

    # Admin 2 should not have received notification
    a2_notifs = db_session.query(Notification).filter(
        Notification.recipient_id == notif_test_setup["admin2_id"]
    ).all()
    assert len(a2_notifs) == 0


def test_notification_endpoints_and_unread_polling(client, notif_test_setup):
    # Employee edits student to trigger notification for Admin 1
    client.cookies.set("access_token", notif_test_setup["emp_cookie"])
    client.patch(
        f"/api/students/{notif_test_setup['student_id']}",
        json={"agent_name": "New Agency"},
    )

    # Check unread count as Admin 1
    client.cookies.set("access_token", notif_test_setup["admin1_cookie"])
    unread_resp = client.get("/api/notifications/unread-count")
    assert unread_resp.status_code == 200
    assert unread_resp.json()["unread_count"] >= 1

    # List notifications
    list_resp = client.get("/api/notifications")
    assert list_resp.status_code == 200
    notifs = list_resp.json()
    assert len(notifs) >= 1
    notif_id = notifs[0]["id"]
    assert notifs[0]["is_read"] is False

    # Mark single as read
    read_resp = client.patch(f"/api/notifications/{notif_id}/read")
    assert read_resp.status_code == 200
    assert read_resp.json()["is_read"] is True

    # Mark all as read
    all_resp = client.post("/api/notifications/read-all")
    assert all_resp.status_code == 200

    # Unread count is now 0
    after_unread = client.get("/api/notifications/unread-count")
    assert after_unread.json()["unread_count"] == 0
