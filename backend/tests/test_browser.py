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
