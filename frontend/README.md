# Emergency Medicine Availability & Shortage Risk Monitoring System

A full-stack application for searching reported medicine availability, managing pharmacy inventory, and monitoring potential medicine-shortage risk.

> **Project status:** Active development. The repository contains a Next.js frontend, an Express/MongoDB backend, and a Python-based ML service. Feature completeness, automated test coverage, and end-to-end ML persistence should be verified before production deployment.

## Contents

- [Overview](#overview)
- [Main capabilities](#main-capabilities)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Environment configuration](#environment-configuration)
- [API health check](#api-health-check)
- [Machine-learning workflow](#machine-learning-workflow)
- [Testing and validation](#testing-and-validation)
- [Security and operational notes](#security-and-operational-notes)
- [Current audit checklist](#current-audit-checklist)

## Overview

Medicine availability can change quickly across pharmacies. This project is intended to make reported availability easier to search, help pharmacy owners manage inventory, and provide shortage-risk predictions that can support monitoring and planning.

Predictions are informational decision-support outputs. They should not be treated as medical advice or as a guarantee that a medicine is or is not available.

## Main capabilities

The repository includes frontend and backend modules for the following areas:

- **Medicine search:** search reported medicine availability.
- **Authentication and roles:** login/registration and role-specific access flows.
- **Pharmacy management:** pharmacy records and owner-facing pharmacy functionality.
- **Inventory management:** manage stock information and stock history.
- **Dashboard:** summarize relevant pharmacy or system information.
- **Shortage-risk monitoring:** access risk-related endpoints and prediction features.
- **Administration:** admin API routes for system-management features.
- **ML service:** a separate Python service using common data-science and machine-learning libraries.

The exact availability of each feature depends on configuration, database contents, and whether the associated workflow has been fully wired and tested.

## Architecture

```text
Browser
  |
  v
Next.js frontend (development default: http://localhost:3000)
  |
  v
Express API (default port: 5000)
  |-- /api/auth
  |-- /api/pharmacies
  |-- /api/medicines
  |-- /api/inventory
  |-- /api/search
  |-- /api/risk
  |-- /api/dashboard
  |-- /api/admin
  |
  v
MongoDB (via Mongoose)

Python ML service
  |-- data preparation / model training / prediction workflows
  |-- integration and persistence must be verified against the current implementation
```

The backend connects to the database before it starts listening for requests. Its health endpoint is `GET /api/health`.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Maps | Leaflet, React Leaflet |
| Backend | Node.js, Express 5, TypeScript |
| Database | MongoDB, Mongoose |
| Authentication | JSON Web Tokens, bcryptjs |
| ML service | Python, NumPy, pandas, scikit-learn, XGBoost, joblib |
| ML API / data access dependencies | FastAPI, Uvicorn, PyMongo |

Versions listed here reflect the package manifests currently inspected; install compatibility should be confirmed in the local environment.

## Repository layout

```text
.
├── frontend/       # Next.js application
├── backend/        # Express API, routes, database models and services
└── ml-service/     # Python machine-learning service and dependencies
```

The exact contents of each folder may evolve during development.

## Prerequisites

Install the following before starting the project:

- Node.js and npm
- Python 3.10+ (use the version required by the ML dependencies if it differs)
- MongoDB, either a local instance or a MongoDB Atlas cluster
- Git

## Local setup

Run each service in its own terminal. Commands below are based on the repository's current package scripts; ML startup commands depend on the actual Python entry point in your checkout.

### 1. Clone the repository

```bash
git clone https://github.com/samiulhasansiam556/emergency-medicine-system.git
cd emergency-medicine-system
```

### 2. Configure the backend

```bash
cd backend
npm install
```

Create `backend/.env` locally and configure the variables expected by the backend, at minimum the MongoDB connection string and any JWT/authentication secrets used by the code.

Example **template only** (confirm the exact variable names in `backend/src/config/database.ts` and the auth implementation before using it):

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/emergency_medicine
JWT_SECRET=replace_with_a_long_random_secret
```

Do not commit real credentials. The variable `MONGODB_URI` above is a placeholder name until confirmed against the database configuration in your checkout.

Start the API:

```bash
npm run dev
```

The backend should connect to MongoDB and then listen on `http://localhost:5000`.

Available backend scripts from `backend/package.json`:

```bash
npm run dev
npm run build
npm run typecheck
npm start
npm run seed       # inserts seed data; inspect before running
npm run db:reset   # destructive: inspect implementation and back up data first
```

**Warning:** `npm run db:reset` may delete or recreate database data. Do not run it against a database containing data you need.

### 3. Configure the frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the frontend needs a backend URL environment variable, use the exact variable name referenced by the frontend API client. Do not assume a variable name without checking `frontend/src/lib/api.ts` or the current API configuration.

Useful scripts from `frontend/package.json`:

```bash
npm run dev
npm run build
npm start
npm run lint
```

### 4. Set up the ML service

In another terminal:

```bash
cd ml-service
python -m venv .venv
```

Activate the virtual environment:

**Windows PowerShell**
```powershell
.\.venv\Scripts\Activate.ps1
```

**macOS/Linux**
```bash
source .venv/bin/activate
```

Install dependencies:

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Inspect the Python files to identify the actual application entry point, training command, prediction command, required environment variables, and database write path before starting the service. Do not assume that training a model automatically persists prediction records to MongoDB; that behavior must be confirmed in the implementation.

## Environment configuration

Keep local secrets in ignored `.env` files and never publish:

- MongoDB connection strings or database credentials
- JWT/session secrets
- API keys or service credentials
- Real user or pharmacy data

Use `.env.example` files containing placeholder values to document required variables. Check `.gitignore` to ensure real environment files and local model/data artifacts are excluded where appropriate.

## API health check

After the backend starts, visit:

```text
http://localhost:5000/api/health
```

Expected response shape:

```json
{
  "success": true,
  "message": "Emergency Medicine API is running",
  "timestamp": "..."
}
```

This confirms that the API process is responding. It does not by itself prove that every route, the ML service, or every database workflow is healthy.

## Machine-learning workflow

The intended workflow should be documented and tested end to end:

1. **Collect source data** from the configured inventory, stock-history, and/or daily snapshot records.
2. **Prepare features** using a consistent date range, medicine/pharmacy identifiers, missing-value policy, and target definition.
3. **Train or retrain** the selected model and evaluate it on an appropriate holdout or time-based split.
4. **Save model artifacts** if the training code supports artifact persistence.
5. **Generate predictions** for the intended future dates or prediction horizon.
6. **Persist prediction results** to the database if the application is designed to retain prediction history.
7. **Expose results through the backend API** and display them in dashboards or risk-monitoring pages.
8. **Track model runs and timestamps** so users can distinguish the latest run from older predictions.

The steps above describe the workflow to verify, not a guarantee that each step is currently implemented. Confirm the actual flow by tracing the ML entry point, training and prediction functions, backend-to-ML calls, and database models/write operations. Also verify how the dashboard chooses the displayed prediction date (for example, latest prediction versus a fixed or aggregated date).

## Testing and validation

The backend repository includes TypeScript test files for areas such as database connectivity, inventory, medicine, pharmacy, stock history, demand records, and shortage predictions.

Before relying on them, confirm how tests are invoked and which test runner or scripts are configured. The current backend `package.json` does not expose a dedicated `test` script, so the presence of files named `test*.ts` does not alone prove that an automated test suite runs.

Suggested checks before merging or deployment:

- Run backend type checking: `npm run typecheck`
- Run backend compilation: `npm run build`
- Run frontend linting: `npm run lint`
- Run a frontend production build: `npm run build`
- Test authentication and role-based authorization.
- Test inventory updates and corresponding stock-history writes.
- Test pharmacy activation/deactivation and owner access restrictions.
- Test empty database states, missing data, and API error responses.
- Test the complete ML training → prediction → persistence → API → dashboard path.
- Confirm date/time-zone behavior for prediction timestamps and reporting periods.

## Security and operational notes

- Enforce authorization in the backend, not only by hiding frontend navigation.
- Validate and sanitize user-supplied data at API boundaries.
- Restrict CORS to the intended frontend origins in production.
- Use strong secrets and rotate any credentials that have been exposed.
- Apply least-privilege database credentials and back up important data.
- Add sensible logging, error handling, and health checks for each service.
- Treat shortage predictions as estimates; document model limitations and monitor prediction quality.
- Do not run seed/reset commands against production data without a reviewed backup and an explicit recovery plan.

## Current audit checklist

These are items to verify as part of the project's engineering audit; they are not all confirmed defects:

- [ ] Confirm exact environment variable names and provide safe `.env.example` files.
- [ ] Confirm all frontend API URLs and backend response shapes agree.
- [ ] Verify role checks and pharmacy ownership checks on every protected backend route.
- [ ] Verify inactive pharmacies cannot perform restricted owner actions.
- [ ] Verify inventory mutations and stock-history writes remain consistent on errors.
- [ ] Verify date/time-zone semantics and the definition of “latest prediction.”
- [ ] Verify the ML service is reachable and failures are handled safely.
- [ ] Verify model artifacts, model-run metadata, and prediction records are saved where intended.
- [ ] Add a documented, reproducible test command and confirm the test files execute.
- [ ] Complete end-to-end testing before production deployment.

## Contributing

1. Create a focused change.
2. Run the relevant checks locally.
3. Avoid committing secrets, local datasets, model binaries, or database dumps.
4. Document new environment variables and commands.
5. Review changes before pushing.

## License

No project license was confirmed during this documentation pass. Add a `LICENSE` file and update this section if you intend to publish the project under a specific license.
