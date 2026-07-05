# ContentSync

**Write once. Publish everywhere.** Smart multi-platform blog auto-publisher.

ContentSync lets a writer author a post in Markdown, pick a publish time, and
then fans the post out to multiple blogging platforms in parallel — each
platform gets a payload tuned to its own conventions (tags, canonical URLs,
cover images, code fences, etc.).

---

## Features

### 📊 Publishing dashboard
- View overall publishing status for every scheduled post.
- Success / failed / publishing status badges on each row and detail page.
- Full per-platform publication history with the remote published URL.
- Inline error messages when a publish fails so the cause is one click away.
- Top-of-page rate-limit banner that surfaces 429 hits in real time and counts
  down until each platform's quota resets.

### 🎨 Frontend
- Modern Next.js 14 App Router (server components for reads, client components
  for forms and live updates).
- Fully responsive dashboard that collapses cleanly from desktop to mobile.
- Dedicated `/login`, `/signup`, and `/settings` pages.
- Markdown post composer with tag, cover image, and target-platform pickers.
- Status badges (`SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `FAILED`) reused across
  the dashboard, post detail, and publication rows.
- Header authentication menu with login, logout, and password-reset flows that
  broadcast a `contentsync:auth-changed` event so every mounted component
  re-reads `/api/auth/me` instantly.
- Tailwind CSS for utility-first styling.

### ⏰ Smart scheduling
- Schedule a post for any future date and time (ISO-8601, UTC).
- Background scheduler (APScheduler) polls the database every 60 seconds for
  due posts.
- When a post's `publish_at` arrives, the dispatcher fires the parallel
  `httpx` POSTs to every selected platform — no manual intervention required.
- A `POST /api/posts/{id}/publish-now` endpoint lets you skip the wait for
  testing or last-minute corrections.

---

## Stack

| Layer        | Tech                                                                                       |
|--------------|--------------------------------------------------------------------------------------------|
| Frontend     | Next.js 14 (App Router), React, Tailwind CSS                                               |
| Backend      | FastAPI 0.115, SQLAlchemy 2, APScheduler 3                                                 |
| Database     | PostgreSQL (Neon free tier works)                                                          |
| Auth         | bcrypt password hashes + Fernet-encrypted platform tokens + itsdangerous session cookies   |
| HTTP client  | `httpx` (async) for parallel platform POSTs                                                |
| Deploy       | Render (backend) + Vercel (frontend) + Neon (DB)                                           |

---

## Supported platforms

| Platform     | Free?            | Where you get the token                                          |
|--------------|------------------|------------------------------------------------------------------|
| Dev.to       | Yes              | [dev.to/settings/extensions](https://dev.to/settings/extensions) |
| WordPress.com | Yes             | [developer.wordpress.com](https://developer.wordpress.com/apps/) |
| Notion       | Yes (caveat)     | [notion.so/my-integrations](https://www.notion.so/my-integrations) — writes to a Notion *page*, not a public blog |
| Blogger      | Yes              | Google Cloud OAuth client (free)                                 |

> Note: Medium deprecated public integration tokens in 2024 and Hashnode moved
> its publishing API behind a Pro plan in May 2026, so both were removed.

---

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Next.js UI  │────▶│  FastAPI /api/*  │────▶│  PostgreSQL      │
│  (Vercel)    │◀────│  (Render)        │◀────│  (Neon)          │
└──────────────┘     │                  │     └──────────────────┘
                     │  APScheduler     │
                     │  poll every 60s  │────▶ parallel httpx ──▶ Dev.to / WP / Notion / Blogger
                     └──────────────────┘
```

---

## Project layout

```
contentsync/
├── backend/
│   ├── requirements.txt
│   ├── Procfile                # uvicorn worker for Render
│   ├── render.yaml             # Render infra-as-code
│   ├── smoke_test.py
│   ├── scripts/
│   │   └── migrate_auth.py     # one-shot schema migration (users + platform_keys + posts.user_id)
│   └── app/
│       ├── main.py             # FastAPI app, CORS, router registration
│       ├── config.py           # pydantic-settings, env-driven
│       ├── database.py         # SQLAlchemy engine + session
│       ├── routes.py           # /api/posts, /api/posts/{id}, /api/posts/{id}/publish-now
│       ├── routes_auth.py      # /api/auth/{signup,login,logout,me}
│       ├── routes_keys.py      # /api/keys/{platform}
│       ├── schemas.py          # Pydantic request/response models
│       ├── models/
│       │   ├── __init__.py     # re-exports User, PlatformKey, Post, Publication
│       │   ├── user.py
│       │   ├── platform_key.py
│       │   └── post.py
│       ├── services/
│       │   ├── auth.py         # bcrypt + Fernet + itsdangerous + get_current_user dep
│       │   ├── dispatcher.py   # builds publishers and dispatches via httpx
│       │   └── scheduler.py    # APScheduler background poller
│       └── publishers/
│           ├── base.py         # BasePublisher abstract class
│           ├── factory.py      # looks up per-user PlatformKey + builds publisher
│           ├── devto.py
│           ├── wordpress.py
│           ├── notion.py
│           └── blogger.py
└── frontend/
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    ├── package.json
    ├── app/
    │   ├── layout.tsx          # root layout, header with auth menu
    │   ├── globals.css
    │   ├── page.tsx            # dashboard
    │   ├── login/page.tsx
    │   ├── signup/page.tsx
    │   ├── settings/page.tsx   # per-platform credentials manager
    │   └── posts/
    │       ├── page.tsx
    │       └── [id]/page.tsx
    ├── components/
    │   ├── PostComposer.tsx
    │   ├── PostActions.tsx
    │   ├── StatusBadge.tsx
    │   └── AuthMenu.tsx
    └── lib/
        └── api.ts              # typed fetch wrappers with `credentials: include`
```

---

## Environment variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql+psycopg://USER:PASS@HOST/DBNAME?sslmode=require
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
SCHEDULER_POLL_SECONDS=60

# Required in production; auto-generated locally so the dev server still boots.
# Generate with:  python -c "import secrets; print(secrets.token_urlsafe(64))"
SESSION_SECRET=

# Required in production; auto-generated locally. Must be a valid Fernet key.
# Generate with:  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

---

## Local development

```bash
# 1. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -c "from app.main import app; print('ok')"

# 2. Migrate (only needed once when upgrading from a pre-auth schema)
.\.venv\Scripts\python.exe scripts/migrate_auth.py

# 3. Frontend
cd ../frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

---

## Multi-user flow

1. **Sign up** at `/signup` — email + password (bcrypt-hashed, never stored in plain text).
2. **Add platform keys** at `/settings` — each platform has its own card. Secrets
   are wrapped with Fernet before they hit the database, so a raw DB dump does
   not leak API tokens. The UI only ever sees the masked form (`abcd****wxyz`).
3. **Create a post** at `/posts` — pick target platforms, write Markdown, hit
   Save.
4. **Scheduler picks it up** at the configured `publish_at` time and fans it out
   to all targets in parallel using your stored credentials.
5. **Inspect results** on the dashboard — each platform gets a `Publication`
   row with its remote URL or error message.

Posts and platform keys are scoped per-user: user A cannot see or affect user B's
posts in any way.

---

## API reference

All responses are JSON unless noted. Authenticated endpoints require a valid
`contentsync_session` cookie (set automatically by `/signup` and `/login`).

### Auth

| Method | Path                  | Body                                  | Returns          |
|--------|-----------------------|---------------------------------------|------------------|
| POST   | `/api/auth/signup`    | `{email, password, display_name?}`    | `201` + `User` + cookie |
| POST   | `/api/auth/login`     | `{email, password}`                   | `200` + `User` + cookie |
| POST   | `/api/auth/logout`    | —                                     | `204`            |
| GET    | `/api/auth/me`        | —                                     | `User`           |

### Platform keys

| Method | Path                        | Body                          | Returns            |
|--------|-----------------------------|-------------------------------|--------------------|
| GET    | `/api/keys`                 | —                             | `[PlatformKeyOut]` |
| PUT    | `/api/keys/{platform}`      | `{secret_value, extra_id?}`   | `PlatformKeyOut`   |
| DELETE | `/api/keys/{platform}`      | —                             | `204`              |

`platform` ∈ `devto | wordpress | notion | blogger`.

`extra_id` is required for everything except `devto` (it carries the WP site
id / Notion parent page id / Blogger blog id).

### Posts

| Method | Path                                | Body                                                        | Returns                       |
|--------|-------------------------------------|-------------------------------------------------------------|-------------------------------|
| GET    | `/api/health`                       | —                                                           | `{status: "ok"}`              |
| GET    | `/api/posts`                        | —                                                           | `[PostSummary]` (scoped to user) |
| POST   | `/api/posts`                        | `{title, markdown_content, cover_image_url?, tags?, publish_at, target_platforms}` | `PostOut`         |
| GET    | `/api/posts/{id}`                   | —                                                           | `PostOut`                     |
| DELETE | `/api/posts/{id}`                   | —                                                           | `204`                         |
| POST   | `/api/posts/{id}/publish-now`       | —                                                           | `{queued: true}`              |

---

## Security notes

* **Passwords**: bcrypt with auto-generated salt (cost factor 12 by default).
* **Platform tokens**: Fernet (AES-128-CBC + HMAC-SHA256) with a per-deploy key.
  Loss of `ENCRYPTION_KEY` invalidates all stored tokens — users will need to
  re-enter them.
* **Sessions**: itsdangerous `URLSafeTimedSerializer` with a 14-day max age.
  Cookie is `HttpOnly`, `SameSite=Lax`. Set `secure=True` once the frontend is
  served over HTTPS.
* **Authorization**: every `/api/posts*` and `/api/keys*` endpoint reads the
  current user from the session cookie and filters by `user_id` — there is no
  way for user A to read user B's data.
* **CORS**: `FRONTEND_URL` is added to `Access-Control-Allow-Origin` and
  `Access-Control-Allow-Credentials` so the session cookie round-trips.

---

## Deployment (Render + Vercel + Neon)

1. **Neon**: create a project, copy the `postgresql+psycopg://...` connection
   string with `?sslmode=require`.
2. **Render**: create a Web Service pointing at `backend/`, build command
   `pip install -r requirements.txt`, start command from `Procfile`. Set
   `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, and `FRONTEND_URL`
   (your Vercel URL) as environment variables. Run
   `python scripts/migrate_auth.py` once against the production DB.
3. **Vercel**: import `frontend/`, set `NEXT_PUBLIC_API_BASE` to your Render
   URL, deploy. Make sure `secure=True` on the session cookie in
   `routes_auth.py` before going live.

---

## License

MIT.