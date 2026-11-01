# Event Management System (EMS)

Software Engineering Mini-Project (UE24CS341A) · PES University · Section F · Team 7

A web application for creating events, registering for them (with waitlist), sending notifications and tracking attendance. Built with the MERN stack (MongoDB, Express, React, Node.js).

## Team

- Prajin Ravi Shankar (PES1UG24CS328)
- Rakshan R (PES1UG24CS365)
- Palash Agarwal (PES1UG24CS312)
- Veladi Yathindra Deveswar (PES1UG24CS854)

## Documentation

- [SRS](docs/FINAL_SRS_DOCUMENT.pdf)
- [SAD](docs/FINAL_SAD_DOCUMENT.pdf)
- [Test Plan](docs/FINAL_TEST_PLAN_DOCUMENT.pdf)
- [Deviations](docs/DEVIATIONS.md)

## Sprints

- Sprint 1: 19 Oct – 23 Oct 2026
- Sprint 2: 26 Oct – 30 Oct 2026

## Workflow

Work from assigned issues on the Project board, use a feature branch, open a Pull Request (`Closes #<issue>`), and get it reviewed before merging to `main`.

## Email notifications

Event lifecycle emails use the MongoDB-backed notification queue; request handlers enqueue jobs rather than contacting SMTP directly. Jobs are written in the same transaction as the event/registration change, so an email cannot be queued for a transaction that rolls back.

- **Registration confirmed:** attendee receives a confirmation and registration code.
- **Event cancelled:** attendees with active registrations receive a cancellation email; their registrations are cancelled in the same transaction.
- **Event approved/rejected:** the organizer receives the decision, including the rejection reason when applicable.
- **Event updated:** registered attendees receive updated event details when an organizer edit is merged.

The worker retries failed deliveries up to four attempts and stores each attempt in `NotificationLog`. Configure SMTP with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and optional `SMTP_FROM`. Set `NOTIFICATION_WORKER_ENABLED=true` to enable the worker and optionally set `NOTIFICATION_RETRY_INTERVAL_MINUTES` to change the retry interval. Keep credentials in environment variables; never commit SMTP secrets.

