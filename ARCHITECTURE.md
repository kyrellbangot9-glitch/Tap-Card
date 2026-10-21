# Tap Card: architecture, file diagnosis and connection flows

Plain HTML, CSS and JavaScript on the front end. Supabase (Postgres + login + REST API) as the back end.
No build step, no npm, no framework. Every file is a plain file you can open in VS Code.

---

## 1. The big picture

```
   NFC tag (holds ONE link)               YOU (admin)
   https://cards.yourbrand.com/c/slug     https://cards.yourbrand.com/admin/
            |                                      |
            | phone reads tag, opens link          | email + password
            v                                      v
   +---------------------+              +------------------------+
   |  index.html         |              |  admin/index.html      |
   |  app.js  card.js    |              |  admin.js  admin.css   |
   |  vcard.js           |              |  card.js (live preview)|
   +----------+----------+              +-----------+------------+
              |  both pages use the same shared files:
              |  config.js  ui.js  store.js  vcard.js  card.js  styles.css  diag.js
              v                                      v
        store.js  --------------- ONE gate to the data ---------------  store.js
              |                                      |
   POST /rest/v1/rpc/get_card              /auth/v1/token (sign in, refresh)
   (no login, one card by slug)            /rest/v1/clients (list, save, delete)
              |                                      |
              +------------------+-------------------+
                                 v
                  SUPABASE  (Postgres + Auth + REST API)
                  table clients      table admins
                  function get_card()   function is_admin()
                  row-level security: visitors can only call get_card(slug);
                  only users listed in admins can read or change the table
```

`config.js` decides the mode. `MODE: "supabase"` keeps records in the browser (for trying things out).
`MODE: "supabase"` uses the real database. Nothing else in the code changes between the two.

---

## 2. Folder layout (keep exactly this)

```
tap-card/
  index.html        public card page
  app.js            public page logic
  card.js           draws a card (used by public page AND admin preview)
  vcard.js          builds the contact file (.vcf)
  store.js          the ONLY file that talks to storage or the API
  ui.js             tiny helpers (DOM builder, toast, copy)
  diag.js           prints errors on screen if a file is missing
  config.js         the file YOU edit (mode, Supabase URL + key, NFC link base)
  seed.js           sample clients for demo mode
  styles.css        design tokens and the card look
  check.html        connection self-test (LOCAL ONLY, delete before deploy)
  supabase.sql      database tables, API function, security rules
  seed.sql          optional sample clients for the database
  _headers          security headers for Cloudflare Pages / Netlify
  _redirects        makes /c/anything open index.html (Cloudflare Pages / Netlify)
  vercel.json       the same rewrite and headers for Vercel
  README.md  ARCHITECTURE.md
  admin/
    index.html      admin page
    admin.js        admin logic
    admin.css       admin styles
```
The two files called `index.html` are different. Never put them in the same folder.

---

## 3. File by file: what it does, what it connects to, and its status

"Verified" means it was run here in headless Chromium with the security headers on, against a
simulated Supabase API, and the SQL was run on a real PostgreSQL 16 server with Supabase's roles
emulated. Nothing has been run against a live Supabase project or a real host yet. Section 8 lists what is
and is not covered.

| File | Function | Reads / calls | Used by | Status |
|---|---|---|---|---|
| `config.js` | Sets `TAP_CONFIG`: mode, NFC link base, Supabase URL and public key | nothing | every page, `store.js` | Verified (both modes) |
| `seed.js` | Three sample clients used only in demo mode | nothing | `store.js` demo adapter | Verified |
| `ui.js` | `Tap.h` (safe element builder, sets text not HTML), `toast`, `copy`, `slugify`, `displayName` | nothing | all JS files | Verified |
| `store.js` | The data gate. Demo adapter (browser storage) and Supabase adapter (sign in, refresh, `get_card`, list, save, delete, 12 s timeout) | `config.js`, Supabase API | `app.js`, `admin.js` | Verified, incl. token expiry and refresh |
| `vcard.js` | Builds the .vcf (name, company, number, email, site, address, socials) with line breaks stripped; opens iPhone Add Contact or downloads for Android | `ui.js` | `card.js` | Verified file content. Real-phone behaviour not verified |
| `card.js` | Draws one card from one record. Picks dark-mode colors from one brand color. Phone row and "Save" button both call `saveContact` | `ui.js`, `vcard.js` | `app.js`, `admin.js` | Verified |
| `app.js` | Public page. Finds the slug (`/c/slug`, `?c=slug` or `#slug`), calls `store.get`, draws the card. Updates when the `#` changes | `store.js`, `card.js` | `index.html` | Verified |
| `index.html` | Public page shell, loads scripts in order. Asset paths start with `/` on purpose, so `/c/slug` still finds `app.js` and `styles.css` | all shared files | the NFC tap | Verified behind the `/c/*` rewrite |
| `diag.js` | Shows which file failed to load or what error stopped the page | nothing | both pages (first script) | Verified |
| `styles.css` | Light and dark design tokens, the card design | fonts from Google Fonts | both pages | Verified: no sideways scroll at 390 px. Dark theme checked by screenshot |
| `admin/index.html` | Admin page shell | shared files via `../` | you | Verified |
| `admin/admin.js` | Sign in, client list and search, edit form, validation, save, duplicate, delete with confirm, NFC link copy, live preview, unsaved-changes guard | `store.js`, `card.js` | `admin/index.html` | Verified |
| `admin/admin.css` | Admin layout (3 columns, 2, then 1 on phones) | `../styles.css` tokens | admin page | Verified (no sideways scroll at 390 px) |
| `supabase.sql` | Creates `clients`, `admins`, `is_admin()`, `get_card()` and the security rules | Supabase | you run it once | Ran clean twice on PostgreSQL 16 (Supabase roles emulated). Visitor and non-admin attacks refused, admin allowed. Not run on a live Supabase project |
| `seed.sql` | Loads 3 sample clients | `supabase.sql` first | you, optional | Ran clean on PostgreSQL 16 |
| `check.html` | 9 automatic checks of your real Supabase setup, including the security checks | `config.js`, Supabase | you, locally | Verified against the simulation. Real project: you run it |
| `_headers` | Strict content security policy and other headers | the host | Cloudflare / Netlify | Verified with a host simulator applying this exact text: zero violations. Not tested on a real host |
| `_redirects` | `/c/*` serves `index.html` | the host | Cloudflare / Netlify | Rewrite behaviour verified with a simulator. Not tested on a real host |
| `vercel.json` | Same rewrite and headers for Vercel (use instead of the two files above) | the host | Vercel | Not tested |

---

## 4. Script load order (why it matters)

Every page loads scripts in this order. Each one adds to a shared `window.Tap` object, so order is the dependency chain.

```
diag.js  ->  config.js  ->  seed.js  ->  ui.js  ->  store.js  ->  vcard.js  ->  card.js  ->  app.js   (public)
                                                                                         ->  admin.js (admin)
```
If one file fails to load, `diag.js` prints its name on the page.

---

## 5. Connection flows

### Flow A. Customer taps the NFC card
```
phone reads tag -> opens https://cards.yourbrand.com/c/kape-ni-lolo
host rewrites /c/*  ->  index.html           (_redirects; the address bar keeps /c/kape-ni-lolo)
index.html loads /diag.js, /config.js ... /app.js   (absolute paths, so they do not resolve to /c/app.js)
app.js    slugFromAddress()  -> "kape-ni-lolo"
app.js    store.get("kape-ni-lolo")
store.js  POST {SUPABASE_URL}/rest/v1/rpc/get_card   body {"p_slug":"kape-ni-lolo"}
          headers: apikey = public key   (no login)
Supabase  runs get_card(), returns that one card's JSON or null
app.js    null -> "card not found"       else -> card.js draws the card
```

### Flow B. Customer taps the phone number or "Save to my contacts"
```
click -> card.js save()
      -> vcard.js buildVCard(client)   makes the .vcf text (CRLF, escaped, no injected lines)
      -> vcard.js saveContact()
           iPhone  : navigates to a blob: URL    -> Add Contact sheet opens
           Android : downloads slug.vcf          -> tap file, choose Contacts
      -> "Copy contact details" fallback appears under the card
```
No server call. The contact file is made in the visitor's browser from the card already loaded.

### Flow C. Admin signs in
```
admin/index.html -> admin.js -> store.init()  reads saved session from browser storage
no session -> login form -> store.login(email, password)
store.js  POST {URL}/auth/v1/token?grant_type=password   {email, password}
Supabase  returns access_token (about 1 hour) + refresh_token
store.js  keeps both in browser storage; every later request sends  Authorization: Bearer <access_token>
admin.js  store.list() -> GET {URL}/rest/v1/clients?select=slug,data
Supabase  RLS: returns rows only if is_admin() is true for this user, otherwise an empty list
```

### Flow D. Admin saves a client
```
Save click -> admin.js validate()  (name, slug format, +country phone, email, https links)
           -> store.save(record)
store.js   POST {URL}/rest/v1/clients?on_conflict=slug      (upsert: create or update)
           body [{slug, data: record, updated_at}]
Supabase   RLS insert/update policy: allowed only if is_admin()
           refused -> admin.js shows "This login is not an admin yet..."
success    -> list refreshes, status "Saved at 11:42". Next tap shows the new details.
```

### Flow E. Session runs out (about every hour)
```
any call returns 401 (JWT expired)
store.js   POST {URL}/auth/v1/token?grant_type=refresh_token  {refresh_token}
           success -> stores new tokens, repeats the SAME request once, admin sees nothing
           failure -> clears session -> admin.js shows the sign-in form
```

### Flow F. Delete
```
Delete -> inline confirm -> store.remove(slug) -> DELETE {URL}/rest/v1/clients?slug=eq.<slug>
RLS delete policy: admins only. The NFC link for that client now shows "card not found".
```

### Flow G. Health check (local)
```
check.html runs 9 checks in order:
 config ok -> visitors cannot list table -> visitors cannot write -> admin sign in
 -> admin write (proves you are in admins) -> admin read -> visitor get_card works
 -> admin delete -> done
```

---

## 6. Security: what protects what

| Threat | Protection | Where |
|---|---|---|
| Someone edits or deletes client records | Row-level security: writes allowed only if the signed-in user is in the `admins` table. Sign-ups also turned off | `supabase.sql`, Supabase settings |
| Someone downloads every client's phone, email and address | The table is closed to visitors. They can only call `get_card(slug)` for a card whose address they already know | `supabase.sql`, `store.js` |
| Public key in the page is misused | It is meant to be public. By itself it can only call `get_card`. Never put a `service_role` or `secret` key in any file (`check.html` warns if you do) | `config.js`, `check.html` |
| Script injection (XSS) from a client's text | Everything is drawn with `textContent`, never inserted as HTML. Links only allow `https`, `http`, `viber`, `tg`, `whatsapp`, `mailto`, `tel`, `sms` | `ui.js`, `card.js` |
| Injected scripts or third-party code | Content security policy: scripts only from your own site, API calls only to your Supabase project, no framing | `_headers` |
| Fake fields smuggled into the contact file | Line breaks stripped from every raw field, other fields escaped | `vcard.js` |
| Admin session lasts forever or dies every hour | Short-lived access token with automatic refresh. Sign out clears it | `store.js` |
| Admin page found by search engines or cached | `noindex` header, `no-store`, and a `robots` meta tag | `_headers`, `admin/index.html` |
| Slow or hanging API | 12 second limit with a clear message | `store.js` |

Known limits you should accept or address later:
- The sign-in token is kept in browser storage, so a script injected on your own site could read it. The content security policy and text-only rendering make that hard, but it is not zero. Use a strong admin password and turn on Supabase's multi-factor sign-in for the admin user when you are ready.
- Anyone who knows or guesses a card address can open that card. That is the point of a public card. Slugs like `kape-ni-lolo` are guessable, so do not put anything on a card you would not print on a paper card.
- There is no rate limit on `get_card` beyond Supabase's own limits. Put the site behind Cloudflare if you expect abuse.
- Clients cannot edit their own card yet. That needs per-client logins and a second policy.

---

## 7. Test it in VS Code, then deploy

### Test locally
1. Unzip `tap-card.zip` into a NEW empty folder. In VS Code: File > Open Folder > `tap-card`. The site root must be this folder itself (the public page loads `/app.js`, so a server started in the parent folder will show the red "files did not load" box).
2. Install the extension "Live Server" (Ritwick Dey), or use the terminal inside VS Code: `python3 -m http.server 8000`.
3. **Demo mode first** (no setup): leave `config.js` as is. Open `http://localhost:8000/` (card list), `http://localhost:8000/admin/` (dashboard). Edit a client and press Save, reload, it stays.
4. **Supabase**:
   1. supabase.com > New project.
   2. SQL Editor > paste all of `supabase.sql` > Run.
   3. Authentication > Users > Add user (email, password, Auto Confirm on). Authentication > Sign In / Providers > Email > turn OFF "Allow new users to sign up".
   4. SQL Editor > run, with your real email:
      `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;`
   5. Optional: paste `seed.sql` > Run (three sample clients).
   6. Project Settings > API: copy the Project URL and the anon or publishable key into `config.js`; set `MODE: "supabase"`.
   7. Open `http://localhost:8000/check.html`, sign in, press Run. Every line must say PASS.
   8. Open `/admin/`, sign in, add a client. Open `http://localhost:8000/index.html#your-slug`.
5. Locally `/c/your-slug` does not work (no rewrite rule). Use `index.html#your-slug` or `index.html?c=your-slug`.

### Deploy (Cloudflare Pages, same steps on Netlify)
1. Delete `check.html` from the folder.
2. In `_headers` replace BOTH words `YOUR-PROJECT` with your Supabase project id (the part before `.supabase.co`). If you forget, the page cannot reach Supabase and the browser console says "violates Content Security Policy".
3. In `config.js` set `CARD_BASE` to your final address, for example `https://cards.yourbrand.com/c/`.
4. Upload the folder (Pages > Create project > Direct Upload) or push to GitHub and connect it.
5. Add your custom domain.
6. Test on a real iPhone and a real Android phone: open a card link, tap the phone number, confirm the contact is offered. Test the admin sign in on the live site.
7. Write each client's link to their tag with the NFC Tools app (Write > Add a record > URL). Tap to test. Then lock the tag.

Vercel: `_headers` and `_redirects` are ignored. Use the included `vercel.json` instead and replace `YOUR-PROJECT` in it too.

If you would rather not use a rewrite rule at all, set `CARD_BASE` in `config.js` to `https://cards.yourbrand.com/?c=` and write links like `https://cards.yourbrand.com/?c=kape-ni-lolo` to the tags. That works on any host.

---

## 8. What was tested and what was not

**Browser tests: 33 checks, all passed.** Headless Chromium, served by a simulator that applies `_headers`
and the `/c/*` rewrite, with Supabase simulated (sign in, refresh, get_card, row-level security behaviour):
- `/c/<slug>` opens the card behind the rewrite. Zero content-security-policy violations on the public page, the admin, and during Supabase calls.
- Tapping the phone number downloads a valid .vcf (name, number, company, email, site, address, socials).
- Hostile card data (script tags, `javascript:` links, line breaks in the phone and label fields) is shown as text, neutralised, and cannot add vCard lines.
- Visitors open a card only through `get_card`; the public page never queries the table; the home page lists nothing in Supabase mode; a direct table read by a visitor returns nothing.
- Wrong password, non-admin sign-in (sees nothing, save refused with the "not an admin yet" message), admin create / reload / edit / delete, session surviving reload, expired token refreshed silently, API unreachable gives a clear message.
- No sideways scroll at 390 px on the public page and the admin. Missing-file messages from `diag.js`.
- `check.html`: all lines pass for an admin; tells a non-admin exactly which SQL to run.

**Database tests on a real PostgreSQL 16 server** (Supabase's `anon` / `authenticated` roles and `auth.uid()` emulated, default table grants open as on Supabase so row-level security is the only gate):
- `supabase.sql` ran clean twice, then `seed.sql`.
- As a visitor: cannot list `clients` or `admins`; insert is refused; update and delete affect 0 rows; `get_card('slug')` returns that one card; an unknown slug returns null.
- As a signed-in non-admin: same refusals.
- As an admin: list, insert, update and delete all work. Bad slugs (capitals, spaces, too short) are rejected. The `admins` table cannot be edited through the API even by an admin.
- After all the attacks the three seeded cards were unchanged.

**Not verified (needs you):**
- `supabase.sql` on your real Supabase project, and Supabase's own sign-in service and REST layer. Everything about those was simulated. `check.html` confirms this in about a minute.
- The Add Contact screen on a real iPhone and the contact import on a real Android phone.
- Writing and tapping a real NFC tag.
- `_headers`, `_redirects` and `vercel.json` on a real host. Only simulated here.

## 9. When something is wrong

| You see | Cause |
|---|---|
| Red box "These files did not load: ..." | file missing or in the wrong folder |
| Public page stuck on "Loading card..." and no red box | `diag.js` itself is missing. Open DevTools (F12) > Network and look for red rows |
| Blank admin page | same as above |
| Console: "violates Content Security Policy" | `YOUR-PROJECT` still in `_headers`, or Supabase URL differs |
| check.html: "SECURITY PROBLEM" | run the latest `supabase.sql` again |
| Admin: "This login is not an admin yet" | run the `insert into public.admins` line |
| Admin saves but card shows old data | hard refresh (Ctrl+Shift+R); check you edited the same slug |
| Edits vanish after reload | `MODE` is still `"demo"` |
