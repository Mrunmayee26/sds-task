"""Opt-in browser regression test. Uses isolated APIs, never Supabase.
Start Vite on 5174 against API port 8001, then RUN_BROWSER_TESTS=1 pytest this file.
"""

import os
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlopen
import pytest

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_BROWSER_TESTS") != "1",
    reason="Browser suite runs in its own CI job",
)


def test_recovery_form_email_otp_and_new_password_steps():
    """Check the form against mocked delivery; API recovery has separate DB tests."""
    from playwright.sync_api import sync_playwright, expect

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page()
            calls = []

            def api(route):
                request = route.request
                if request.method == "OPTIONS":
                    route.fulfill(
                        status=204,
                        headers={
                            "Access-Control-Allow-Origin": "*",
                            "Access-Control-Allow-Headers": "*",
                        },
                    )
                    return
                data = request.post_data_json
                calls.append((request.url, data))
                if request.url.endswith("/request-password-otp"):
                    assert data == {"email": "applicant@coep.ac.in"}
                    payload = {"message": "Check your inbox for a verification code."}
                elif request.url.endswith("/verify-password-otp"):
                    assert data == {"email": "applicant@coep.ac.in", "otp": "123456"}
                    payload = {
                        "token": "isolated-browser-recovery-token",
                        "message": "Email verified. Choose a new password.",
                    }
                else:
                    assert data == {
                        "token": "isolated-browser-recovery-token",
                        "password": "RecoveredPassword42",
                    }
                    payload = {"message": "Password updated. Sign in again."}
                route.fulfill(
                    json=payload, headers={"Access-Control-Allow-Origin": "*"}
                )

            page.route("**/api/v1/auth/*", api)
            page.goto("http://127.0.0.1:5174/forgot-password")
            page.get_by_label("College email", exact=True).fill("applicant@coep.ac.in")
            page.get_by_role(
                "button", name="Send verification code", exact=True
            ).click()
            expect(page.get_by_label("Verification code", exact=True)).to_be_visible()
            expect(page.get_by_label("New password", exact=True)).to_have_count(0)
            page.get_by_label("Verification code", exact=True).fill("123456")
            page.get_by_role("button", name="Verify code", exact=True).click()
            page.get_by_label("New password", exact=True).fill("RecoveredPassword42")
            page.get_by_label("Confirm password", exact=True).fill(
                "DifferentPassword42"
            )
            page.get_by_role("button", name="Update password", exact=True).click()
            expect(page.get_by_role("alert")).to_have_text("Passwords do not match.")
            assert len(calls) == 2
            page.get_by_label("Confirm password", exact=True).fill(
                "RecoveredPassword42"
            )
            page.get_by_role("button", name="Update password", exact=True).click()
            expect(page.get_by_role("status")).to_have_text(
                "Password updated. Sign in again."
            )
            assert len(calls) == 3
        finally:
            browser.close()


def test_admin_request_booking_and_cancellation_workflow():
    from playwright.sync_api import sync_playwright, expect

    backend = Path(__file__).resolve().parents[1]
    log = (backend.parent / "output").resolve()
    log.mkdir(exist_ok=True)
    with (log / "browser-api.log").open("w", encoding="utf-8") as output:
        process = subprocess.Popen(
            [sys.executable, str(backend / "tests/serve_browser_test.py")],
            cwd=backend,
            stdout=output,
            stderr=subprocess.STDOUT,
        )
        try:
            for _ in range(60):
                if process.poll() is not None:
                    pytest.fail(
                        "Isolated API failed to start; see output/browser-api.log"
                    )
                try:
                    with urlopen("http://127.0.0.1:8001/health", timeout=1) as response:
                        if response.status == 200:
                            break
                except Exception:
                    time.sleep(0.5)
            else:
                pytest.fail("Isolated API startup timed out")
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch()
                try:
                    admin = browser.new_context().new_page()
                    applicant = browser.new_context().new_page()
                    reviewer = browser.new_context().new_page()

                    def login(page, email, role="applicant"):
                        page.goto(
                            "http://127.0.0.1:5174/admin/login"
                            if role == "admin"
                            else "http://127.0.0.1:5174/"
                        )
                        page.get_by_label("College email").fill(email)
                        page.get_by_label("Password", exact=True).fill("BrowserTest42")
                        if role == "approver":
                            page.locator("label").filter(
                                has_text="Review requests"
                            ).click()
                        page.get_by_role("button", name="Sign In", exact=True).click()
                        expect(page).to_have_url(
                            f"http://127.0.0.1:5174/{role}/dashboard"
                        )

                    login(admin, "admin@coep.ac.in", "admin")
                    login(applicant, "applicant@coep.ac.in")
                    applicant.get_by_role(
                        "link", name="Request reviewer access"
                    ).click()
                    applicant.get_by_label("Position and reason for access").fill(
                        "I am the newly appointed campus coordinator."
                    )
                    applicant.get_by_role(
                        "button", name="Submit access request"
                    ).click()
                    expect(
                        applicant.get_by_text("Test Review Group · pending")
                    ).to_be_visible()
                    admin.get_by_role(
                        "link", name="Reviewer requests", exact=True
                    ).click()
                    admin.get_by_role("button", name="Save decision").click()
                    expect(admin.get_by_text("Status: approved")).to_be_visible()
                    applicant.reload()
                    expect(
                        applicant.get_by_role("button", name="Switch to approver")
                    ).to_be_visible()
                    applicant.get_by_role(
                        "link", name="Book a venue", exact=True
                    ).click()
                    applicant.get_by_role(
                        "combobox", name="Venue", exact=True
                    ).select_option("1")
                    applicant.get_by_label("Event title").fill(
                        "Automated browser regression"
                    )
                    applicant.get_by_label("Expected attendance").fill("20")
                    date = (
                        (datetime.now(timezone.utc) + timedelta(days=7))
                        .date()
                        .isoformat()
                    )
                    applicant.get_by_label("Date", exact=True).fill(date)
                    applicant.get_by_label("Start time", exact=True).fill("10:00")
                    applicant.get_by_label("End time", exact=True).fill("11:00")
                    applicant.get_by_role(
                        "button", name="Submit request", exact=True
                    ).click()
                    expect(applicant).to_have_url(
                        "http://127.0.0.1:5174/applicant/bookings/1"
                    )
                    login(reviewer, "reviewer@coep.ac.in", "approver")
                    reviewer.get_by_role("link", name="View details →").first.click()
                    reviewer.get_by_role(
                        "button", name="Approve request", exact=True
                    ).click()
                    expect(reviewer.get_by_role("status")).to_have_text(
                        "Booking approved."
                    )
                    applicant.reload()
                    expect(applicant.locator(".status-approved").first).to_be_visible()
                    reviewer.get_by_role(
                        "button", name="Revoke this Booking", exact=True
                    ).click()
                    reviewer.get_by_label("Reason for Revocation", exact=False).fill(
                        "Maintenance requires a new time"
                    )
                    reviewer.get_by_role(
                        "button",
                        name="Confirm Revoke & Trigger Reassignment",
                        exact=True,
                    ).click()
                    expect(
                        reviewer.get_by_text("Needs Reassignment", exact=True)
                    ).to_be_visible()
                    applicant.reload()
                    new_date = (
                        (datetime.fromisoformat(date) + timedelta(days=1))
                        .date()
                        .isoformat()
                    )
                    applicant.get_by_label("Date", exact=True).fill(new_date)
                    applicant.get_by_role(
                        "button",
                        name="Reassign & Restart Multi-Level Approval",
                        exact=True,
                    ).click()
                    expect(applicant).to_have_url(
                        "http://127.0.0.1:5174/applicant/bookings/2"
                    )
                    reviewer.goto("http://127.0.0.1:5174/approver/bookings/2")
                    reviewer.get_by_role(
                        "button", name="Approve request", exact=True
                    ).click()
                    expect(reviewer.get_by_role("status")).to_have_text(
                        "Booking approved."
                    )
                    applicant.reload()
                    expect(applicant.locator(".status-approved").first).to_be_visible()
                    applicant.once("dialog", lambda dialog: dialog.accept())
                    applicant.get_by_role(
                        "button", name="Cancel booking", exact=True
                    ).click()
                    expect(applicant.get_by_role("status")).to_have_text(
                        "Your booking has been cancelled."
                    )
                    applicant.get_by_role("link", name="My profile", exact=True).click()
                    applicant.get_by_role(
                        "button", name="Edit Profile", exact=True
                    ).click()
                    applicant.get_by_label("Full Name", exact=True).fill(
                        "Browser Applicant"
                    )
                    applicant.get_by_role(
                        "button", name="Save Changes", exact=True
                    ).click()
                    expect(
                        applicant.get_by_role(
                            "heading", name="Browser Applicant", exact=True
                        )
                    ).to_be_visible()
                    applicant.get_by_role("link", name="Schedule", exact=True).click()
                    applicant.get_by_label("View", exact=True).select_option("week")
                    expect(applicant.locator(".gcal-container")).to_be_visible()
                    applicant.get_by_label("Week containing", exact=True).fill(new_date)
                    expect(applicant.locator(".gcal-event-block")).to_have_count(2)
                    applicant.screenshot(path=str(log / "weekly-calendar.png"))
                    applicant.set_viewport_size({"width": 390, "height": 844})
                    applicant.screenshot(path=str(log / "weekly-calendar-mobile.png"))
                    assert applicant.evaluate(
                        "document.documentElement.scrollWidth <= innerWidth"
                    )
                    applicant.locator(
                        f'a[href*="date={new_date}"][href*="start_time=09:00"]'
                    ).first.click()
                    expect(applicant.get_by_label("Date", exact=True)).to_have_value(
                        new_date
                    )
                    expect(
                        applicant.get_by_label("Start time", exact=True)
                    ).to_have_value("09:00")
                    expect(
                        applicant.get_by_label("End time", exact=True)
                    ).to_have_value("10:00")
                    admin.screenshot(path=str(log / "admin-dashboard.png"))
                finally:
                    browser.close()
        finally:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
