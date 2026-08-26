# 🛠️ DISAPPEAR — DEVELOPMENT & STAGING ENVIRONMENT GUIDE

This document establishes the official workflow for building, testing, and verifying changes in the **Development & Staging Environment** before releasing updates to the **Production Environment** (`https://disappearco.com`).

---

## 🌿 1. Git Branching Strategy

| Branch | Environment | URL / Target | Description |
| :--- | :--- | :--- | :--- |
| `dev` | **Development / Staging** | `http://localhost:5173` / `https://dev-disappear.up.railway.app` | All feature work, bug fixes, and UI changes are developed and verified here first. |
| `main` | **Production** | `https://disappearco.com` | Protected production branch. Deploys to live production containers on Railway. |

---

## 💻 2. Local Development Setup (Instant Feedback Loop)

### Quick Start with Local Vite + FastAPI:
1. **Start Backend (FastAPI + SQLite/Postgres):**
   ```bash
   # Activate virtual environment
   source .venv/bin/activate  # (or .venv\Scripts\activate on Windows)
   
   # Run local dev server with auto-reload
   python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Start Frontend (Vite HMR):**
   ```bash
   cd frontend
   npm run dev
   # Access UI at http://localhost:5173
   ```
   *Vite automatically proxies API calls to `http://127.0.0.1:8000` when running locally.*

---

## 🐳 3. Docker Compose Development Environment

To run the complete isolated stack in Docker locally:
```bash
docker-compose -f docker-compose.dev.yml up --build
```
- **Frontend Dev Server:** `http://localhost:5173`
- **Backend API:** `http://localhost:8000`

---

## 🚀 4. Workflow: Developing & Releasing Features

### Step 1: Switch to Dev Branch
```bash
git checkout dev
```

### Step 2: Implement & Test Local Changes
- Test UI components, API endpoints, and database queries.
- Build frontend production bundle locally to verify zero build warnings/errors:
  ```bash
  cd frontend
  npm run build
  ```

### Step 3: Commit & Push to Dev
```bash
git add .
git commit -m "feat(module): add new staging feature"
git push origin dev
```

### Step 4: Verify in Dev / Staging Environment
- Log into staging (`https://dev-disappear.up.railway.app` or local dev instance).
- Verify database queries, 2FA, logins, and card/alias masking tools.

### Step 5: Merge Dev to Production (`main`)
Once 100% verified and approved:
```bash
git checkout main
git merge dev
git push origin main
```
*Railway automatically triggers a production deployment to `https://disappearco.com` upon `git push origin main`.*

---

## 🛡️ 5. Quality Assurance Verification Checklist Before Prod Release

- [ ] `npm run build` in `frontend/` succeeds cleanly with 0 syntax errors.
- [ ] `python -c "import backend.main"` imports cleanly with 0 syntax errors.
- [ ] User login & session persistence verified across tab refreshes.
- [ ] Native Capacitor mobile sync verified (`npx cap sync`).
- [ ] CORS headers present on all static assets (`Access-Control-Allow-Origin: *`).
