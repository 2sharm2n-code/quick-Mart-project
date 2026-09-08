# Quick Mart Recruitment System

A full-stack web application for managing job postings and candidate applications for Quick Mart. The system provides a public careers experience for applicants and an administrative dashboard for reviewing applications and tracking recruitment status.

> **Project note:** This repository is a reconstruction of the Quick Mart recruitment project. It also contains recovery-oriented source files and database migrations from the earlier implementation. Secrets and credentials must never be committed.

## Features

- **Job listing** — Displays currently open positions with location, employment type, and descriptions.
- **Job details** — Provides a dedicated page for viewing a position before applying.
- **Application submission** — Candidates can submit their details, resume link, and cover letter.
- **Admin dashboard** — Administrators can view submitted applications in one place.
- **Status tracking** — Application status can be updated from the admin dashboard using Pending, Reviewed, Interview, Rejected, or Hired.
- **PostgreSQL persistence** — Job and application information is stored in PostgreSQL.
- **Responsive frontend** — Uses standard HTML, CSS, and JavaScript for straightforward deployment and maintenance.

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** PostgreSQL
- **Frontend:** HTML5, CSS3, JavaScript
- **API:** REST-style Express endpoints
- **Configuration:** Environment variables with `.env`

## Project Structure

```text
quick-Mart-project/
├── backend/
│   ├── config/
│   │   └── db.js
│   ├── sql/
│   │   └── schema.sql
│   └── server.js
├── frontend/
│   ├── index.html
│   ├── job-details.html
│   ├── apply.html
│   ├── admin.html
│   ├── script.js
│   └── style.css
├── .env.example
├── package.json
└── README.md
```

## Installation

### 1. Install dependencies

From the project root:

```bash
npm install
```

### 2. Set up PostgreSQL

Create a PostgreSQL database named `quick_mart_db`.

The application initializes the database schema from `backend/sql/schema.sql` when the server starts.

### 3. Configure `.env`

Create a `.env` file in the project root using `.env.example` as a template. Configure your PostgreSQL connection values:

```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=quick_mart_db
DB_PASSWORD=your_password_here
DB_PORT=5432
```

**Never commit real passwords, API keys, tokens, OAuth credentials, or other secrets to GitHub.**

### 4. Start the application

```bash
npm start
```

For development with automatic restarts:

```bash
npm run dev
```

## Usage

1. Open the public homepage in your browser.
2. Browse the available Quick Mart vacancies.
3. Select **View Job Details** to review a position.
4. Select **Apply for this Job** and complete the application form.
5. Open the **Admin Login** link from the public site to access the administrative dashboard.
6. Review submitted candidates and change their recruitment status using the Status dropdown.
7. The selected status is sent to the backend and saved in PostgreSQL.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/jobs` | List open jobs |
| GET | `/api/jobs/:id` | Get one job |
| POST | `/api/apply` | Submit an application |
| GET | `/api/applications` | List applications |
| PATCH | `/api/applications/:id/status` | Update an application's status |

### Valid application statuses

- `Pending`
- `Reviewed`
- `Interview`
- `Rejected`
- `Hired`

## Screenshots

Add screenshots as the interface is finalized:

- `![Homepage](screenshots/homepage.png)`
- `![Job Details](screenshots/job-details.png)`
- `![Application Form](screenshots/application-form.png)`
- `![Admin Dashboard](screenshots/admin-dashboard.png)`

## Development Notes

The repository is being rebuilt as the Quick Mart Recruitment System. Keep environment secrets outside source control and use `.env.example` to document required configuration values.

## License

This project is intended for academic and demonstration purposes.
