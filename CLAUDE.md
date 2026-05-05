# CI/CD

- **Org:** github.com/nathanblatter
- **Runner:** Native macOS GitHub Actions runner on Mac Mini (launchd service at ~/actions-runner)
- **Deploy trigger:** Push to `main` branch
- **Deploy workflow:** `.github/workflows/deploy.yml` — pulls latest code in `/Users/nathanblatter/Desktop/Personal-Site/backend`, builds Docker image, starts prod compose, runs seed
- **Secrets:** `backend/.env.prod` file on host (gitignored)
- **Infrastructure:** Docker Compose (FastAPI backend), shared Postgres from docker-services, frontend served separately
