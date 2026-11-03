# Event Management System (EMS)

Software Engineering Mini-Project (UE24CS341A) · PES University · Section F · Team 7

A MERN-stack web application for managing events, attendee registrations, waitlists, QR check-in, notifications and attendance reports.

## Features

- **Role-based access:** Admin, Organizer and Attendee accounts.
- **Event management:** Create events, review/approve submissions, and edit an organizer's own upcoming events. Editing a published event returns it to **Pending Approval**.
- **Registration and waitlists:** Confirmed/waitlisted registrations, registration status and QR receipts.
- **Attendance:** Organizers can check in attendees using a registration code, QR camera scan or QR image. Duplicate and out-of-window check-ins are rejected.
- **Reports:** Event attendance summaries and CSV export; administrators can view platform summaries and manage users/categories.
- **Notifications:** MongoDB-backed email queue for registration confirmations, event decisions, cancellations and updates. Failed deliveries are retried and logged. Reminder scheduling is also supported.
- **Security and operations:** Password reset, login/API rate limiting, role/ownership checks, audit logs, health endpoint and database backup/restore utilities.

## Tech stack

- **Frontend:** React, Vite, React Router, Axios
- **Backend:** Node.js, Express, Mongoose
- **Database:** MongoDB (replica set or MongoDB Atlas with transaction support)
- **Testing:** Jest, Supertest, Node.js integration tests, Vitest, React Testing Library

## Requirements

- Node.js 22.12+ (Node.js 24 recommended)
- npm
- MongoDB replica set or MongoDB Atlas deployment that supports transactions
- Optional SMTP account for sending real email notifications

## Run locally

Open separate terminals for the backend and frontend.

### 1. Get the project

```bash
git clone https://github.com/SE-Miniproject-Team7/Event-Management-System.git
cd Event-Management-System
```

### 2. Configure and start the backend

```bash
cd backend
npm ci
```

Create your local environment file from the example:

- macOS/Linux: `cp .env.example .env`
- Windows PowerShell: `Copy-Item .env.example .env`

Edit `backend/.env` and set at least:

- `MONGO_URI` — your MongoDB replica-set/Atlas connection string
- `JWT_SECRET` — a long, random secret
- `CLIENT_ORIGIN=http://localhost:5173`

Then start the API:

```bash
npm run dev
```

The API defaults to **http://localhost:5000**. Check database/API health at [http://localhost:5000/health](http://localhost:5000/health).

> **Important:** The application uses MongoDB transactions for operations such as registration, check-in, audit logging and notification enqueueing. A standalone MongoDB server without replica-set support is not sufficient.

### 3. Configure and start the frontend

In a new terminal, from the repository root:

```bash
cd frontend
npm ci
```

Create the local environment file:

- macOS/Linux: `cp .env.example .env`
- Windows PowerShell: `Copy-Item .env.example .env`

The example sets `VITE_API_BASE_URL=http://localhost:5000/api`. Change it only if your backend uses another address.

Start the development server:

```bash
npm run dev
```

Open **http://localhost:5173**.

### 4. Optional: seed demo data

The backend seed script requires `SEED_PASSWORD` in `backend/.env`. It creates demo Admin, Organizer and Attendee accounts, categories, registrations and **5,000 synthetic events**. Run it only against a development database:

```bash
cd backend
npm run seed
```

The script prints the Admin email; the configured `SEED_PASSWORD` is used for newly created seed accounts. Do not run this against production data.

### Email configuration (optional)

To send real email, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and optionally `SMTP_FROM` in the private backend `.env`. Set `NOTIFICATION_WORKER_ENABLED=true` to enable delivery. Keep secrets out of Git. The app can be run without enabling live SMTP delivery.

## Tests and quality checks

Run commands from the relevant directory.

**Backend** (`backend/`):

```bash
npm test
npm run test:coverage
```

For real MongoDB integration tests, configure `MONGO_TEST_URI` to a **dedicated disposable replica-set database whose name starts with `ems_test_`**, then run:

```bash
npm run test:integration
npm run test:reset
```

**Frontend** (`frontend/`):

```bash
npm test
npm run lint
npm run build
```

Coverage details and recorded evidence are in [docs/testing/CODE_COVERAGE_REPORT.md](docs/testing/CODE_COVERAGE_REPORT.md). Its 90.35% statement-coverage figure applies to the measured **backend module scope only**, not the frontend or the whole project.

## Documentation

- [Software Requirements Specification (SRS)](docs/FINAL_SRS_DOCUMENT.pdf)
- [Software Architecture Document (SAD)](docs/FINAL_SAD_DOCUMENT.pdf)
- [Final Test Plan](docs/FINAL_TEST_PLAN_DOCUMENT.pdf)
- [Deviations from requirements](docs/DEVIATIONS.md)
- [Operations, health checks and database recovery](docs/OPERATIONS.md)
- [Attendee check-in workflow and API rules](docs/CHECK_IN.md)
- [Password reset](docs/PASSWORD_RESET.md)
- [Audit logging](docs/AUDIT_LOGGING.md)
- [Testing reports and evidence](docs/testing/README.md)
- [Sprint 2 demo recording guide](docs/testing/SPRINT2_RECORDING_GUIDE.md)

## Team

- Prajin Ravi Shankar (PES1UG24CS328)
- Rakshan R (PES1UG24CS365)
- Palash Agarwal (PES1UG24CS312)
- Veladi Yathindra Deveswar (PES1UG24CS854)

**Sprint schedule:** Sprint 1 — 19–23 October 2026 · Sprint 2 — 26–30 October 2026

## Contribution workflow

Pick an assigned issue, create a feature branch, add/update tests and documentation as needed, and open a pull request referencing the issue (for example, `Closes #44`). Get the change reviewed and required checks passing before merging into `main`.

Never commit `.env` files, passwords, SMTP credentials, reset links, real attendee data or database backups.
