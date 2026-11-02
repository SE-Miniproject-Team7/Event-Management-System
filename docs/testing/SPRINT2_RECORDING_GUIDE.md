# Sprint 2 working-product video — two-minute recording guide

Owner: Rakshan (#44). Record localhost using the latest reviewed main. Deliverable
3 testing/report generation proceeds alongside this Sprint 2 obligation.

## Prepare before recording

1. Start replica-set MongoDB, backend and frontend. Rehearse the flow once.
2. Prepare Admin, Organizer and Attendee accounts in separate browser profiles
   or browsers, because tabs in one profile share the authentication cookie.
3. Create "Sprint 2 Demo Workshop", owned by the demo Organizer. Approve it
   before recording. Set start about 30 minutes ahead, end about 90 minutes
   ahead, registration deadline about 10 minutes ahead, and leave seats free.
   This supports both registration and the start-minus-one-hour check-in window.
4. Ensure the attendee has not already registered. Prepare a second event in
   Pending Approval for the admin demonstration.
5. Keep .env, passwords, SMTP credentials and reset links out of the video.
   Leave the workshop Published until its check-in is finished.

## Recording sequence

| Time | Screen and actions | Suggested narration |
|---|---|---|
| 0:00–0:08 | Homepage | "This is our Event Management System Sprint 2 demonstration, running locally. We'll show registration, QR check-in, reporting and administration." |
| 0:08–0:35 | Sign in as attendee. Explore Events → demo workshop → Register. Show confirmation/QR, then My Registrations with Confirmed status and saved QR. | "Attendees can register and retrieve their registration code and QR from My Registrations." |
| 0:35–1:00 | Switch to organizer. Check in attendees → same workshop → paste registration code → submit. Show success, then duplicate rejection. Use QR scanning if reliable in the recording setup. | "Organizers check in confirmed attendees within the permitted window. Duplicate check-ins are rejected." |
| 1:00–1:25 | Event reports → workshop. Show counts, checked-in row and attendance percentage. Download CSV and briefly open it. | "Reports reflect recorded attendance, and organizers can export their event's registration data." |
| 1:25–1:52 | Switch to admin. Approve the second pending event. Open platform summary. If time permits, show users/categories navigation. | "Administrators approve events, manage users and categories, and view the platform summary." |
| 1:52–2:00 | Close on the application | "This completes our Sprint 2 working-product demonstration. Deliverable 3 testing and reports are being completed separately." |

## After recording

Watch the entire recording. Check readable text, working actions, understandable
audio and a duration around two minutes. Upload `docs/Sprint2_demo.mp4` through
a teammate-reviewed PR referencing #44. Keep #44 open until final documentation
and freeze requirements are also satisfied.

Two minutes is a working-product demonstration, not evidence for every test.
Password reset, reminders, waitlist behaviour and other detailed cases belong
in the test reports. Do not narrate a function as demonstrated if it is absent
from the recording. Use sample data rather than real attendee details.
