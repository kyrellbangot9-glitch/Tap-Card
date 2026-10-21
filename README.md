# Tap Card: NFC digital business cards

Start here, then read `ARCHITECTURE.md` for every file's function, the connection flows, security and deploy steps.

## 60-second demo (no setup)
1. Unzip into a new empty folder and open it in VS Code.
2. Terminal, inside the tap-card folder: `python3 -m http.server 8000` (or Live Server with that folder opened as the project root).
3. Open http://localhost:8000/ for the cards and http://localhost:8000/admin/ for the dashboard.

## Connect your real database
1. Supabase: new project > SQL Editor > run all of `supabase.sql`.
2. Authentication > Users > add yourself. Turn OFF "Allow new users to sign up".
3. Run once, with your email:
   `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;`
4. Optional sample data: run `seed.sql`.
5. `config.js`: set `MODE: "supabase"`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (anon or publishable key only, never a secret key).
6. Open http://localhost:8000/check.html and run the checks. Every line must say PASS.
7. Open /admin/, sign in, add a client, then open `index.html#your-slug`.

## Before you deploy
- Delete `check.html`.
- In `_headers`, replace both `YOUR-PROJECT` with your Supabase project id.
- In `config.js`, set `CARD_BASE` to your real address.
- Upload to Cloudflare Pages or Netlify (they read `_headers` and `_redirects`).

## Folder layout (do not flatten)
```
index.html app.js card.js vcard.js store.js ui.js diag.js config.js seed.js styles.css
check.html supabase.sql seed.sql _headers _redirects vercel.json README.md ARCHITECTURE.md
admin/index.html  admin/admin.js  admin/admin.css
```
