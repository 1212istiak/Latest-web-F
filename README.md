# TVR Dubbers — Full-Stack Deliverable

Cinematic Bangla-dubbed donghua streaming site with admin panel.

## Structure

```
tvr-dubbers/
  frontend/   # Static site for Vercel — index.html, admin.html, styles.css, app.js, admin.js, config.js
  backend/    # Node/Express + Turso for Render — server.js, migrate.js, seed-admin.js, schema.sql
```

## 1. Backend (Render + Turso)

Full details: `backend/README.md`.

```bash
cd backend
cp .env.example .env
# fill TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, JWT_SECRET, FRONTEND_URL
npm install
npm run migrate
npm run seed-admin
npm start
```

Deploy to Render:
1. Push `backend/` to a GitHub repo.
2. Render → New → Web Service → connect repo.
3. Build: `npm install`. Start: `npm start`.
4. Add env vars from `.env.example`.
5. After first deploy, run `node migrate.js && node seed-admin.js` once (locally against the same Turso DB, or via Render Shell).

Turso setup:
```bash
turso db create tvr-dubbers
turso db show tvr-dubbers --url          # -> TURSO_DATABASE_URL
turso db tokens create tvr-dubbers        # -> TURSO_AUTH_TOKEN
```

## 2. Frontend (Vercel)

Edit `frontend/config.js`:
```js
window.TVR_CONFIG = { API_BASE: "https://your-backend.onrender.com" };
```

Deploy `frontend/` folder to Vercel (static hosting, no build step). The included `vercel.json` maps `/admin` → `/admin.html`.

Make sure the backend's `FRONTEND_URL` env var contains your Vercel origin (comma-separated for multiple).

## 3. First login

- Tap the header title **5 times quickly** → password modal, or visit `/admin` directly.
- Default password: **`rocky@17`**
- Change it immediately: Admin → Password.

## Features

- Dark glassmorphism + light mode (respects system preference on first load)
- Color-cycling titles + edge-cycling tiles
- GPU-accelerated cursor / tap FX + adaptive particles (auto-scale on low-core devices, pause when tab hidden)
- Sticky header with live search (thumbnail dropdown, "Coming Soon" on no match)
- Hero with Watch Now / Upcoming Episode → modal player
- Admin-editable countdown
- Special Episode collection: collapsed strip + fullscreen grid
- 2-column responsive episode grid with genre chips, "New" and "Resume" badges, skeleton loaders, lazy-loaded thumbnails
- Modal player: Primary (Dailymotion) / Backup (Rumble) tabs, iframe from validated URL, next-episode suggestion
- Comments (near-real-time polling, sanitized) + reactions (7 emoji, fly-up animation, one per visitor)
- Footer: caption, team leader, voice-artist box, socials (Facebook/YouTube/Telegram/WhatsApp/Instagram/Dailymotion/Rumble)
- Admin panel: upload / edit / delete episodes, trailer, site settings, links, voice artists, change password, comment moderation
- Bcrypt (rounds 12) + JWT sessions, rate limits: 5 login/15 min, 3 comments/min
- URL normalizer for Dailymotion/Rumble — accepts raw URL, embed URL, or `<iframe>` HTML
- Open Graph / Twitter Card share endpoint at `GET /share/episode/:id`
- Deep link `?ep=<id>` auto-opens the player

## Environment variables (Render)

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET` (long random string)
- `FRONTEND_URL` (Vercel origin — comma-separated for multiple)
- `PUBLIC_BACKEND_URL`

## Notes

- Reactions/comments are per-episode. One reaction per browser (localStorage visitor id).
- Watch-progress uses localStorage; the last-watched episode gets a "Resume" badge.
- Particles auto-scale based on `navigator.hardwareConcurrency`.
- No local file / JSON storage — everything persists in Turso.
