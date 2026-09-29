# PG Manager

An installable PWA to manage multiple PGs (paying guest accommodations). Each PG
is a tab in the left sidebar and has its own dashboard, rooms and members.

## Features

- **Google sign-in** (Firebase Authentication) with a local demo mode fallback
- **Multiple PGs** as left-side tabs — named `1`, `2`, `3` by default, renameable
- **Dashboard** per PG
  - vacancies right now
  - people vacating in the next 30 days (with names, rooms, days left)
  - beds free within 30 days, rooms, bed count, occupancy %, monthly rent
- **Rooms** — add rooms with number, floor, how many people it can accommodate,
  rent per bed and AC flag; a visual bed strip shows filled vs free beds
- **Members** — full tenant details (name, phone, room, join date, vacate date,
  rent, notes) with search and Active / Leaving / Past filters
- **Bulk add rooms** — describe room types (e.g. 19 two-sharing + 16 three-sharing),
  floors and rooms per floor; numbers like 101, 102…, G01 are generated, you can
  tweak each row in a preview, existing numbers are skipped, and it can be undone
- **Tenant invite link** — one private link per PG to share on WhatsApp. Tenants
  sign in with Google, fill in their details, photo and ID proof and pick a free
  bed (each bed can be claimed only once, and each Google account can send only
  one request per link; a rejected tenant may try again). Requests appear as "N new tenant requests" for you to
  approve or reject. The link can be turned off or replaced any time.
- **Export all data (Excel)** — sidebar button downloads a backup workbook with
  Summary, Rooms, Current members, Vacating in 30 days and Past members tabs
- **Address, photo and ID proof** per member (PDF up to 1 MB; images are
  compressed to about 300 KB), stored in
  Firestore — no paid Firebase Storage needed
- Room capacity is enforced: a full room cannot take another member
- Works offline and installs to a phone home screen

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Without Firebase keys the app starts in **demo
mode**: click *Continue in demo mode* and all data is stored in that browser.

## Enable real Google login and cloud sync

You need a free Google account. The Firebase **Spark** plan is free and does not
require a credit card.

1. Go to https://console.firebase.google.com and **Add project** (Google
   Analytics can be turned off).
2. **Build → Authentication → Get started → Sign-in method**:
   - **Google → Enable**, pick a support email, and save (manager login).
3. **Build → Firestore Database → Create database → Start in production mode**,
   choose a region near you (e.g. `asia-south1`).
4. In **Firestore → Rules**, paste the whole contents of
   [`firestore.rules`](./firestore.rules) and **Publish**. Each manager can only
   read and write their own data; tenants can only submit a request through an
   active invite link. Re-publish whenever this file changes.
5. **Project settings → Your apps → Web (`</>`)** — register an app and copy the
   `firebaseConfig` values.
6. Copy `.env.example` to `.env` and fill in those values:

   ```bash
   cp .env.example .env
   ```

7. Restart `npm run dev`. The login screen now shows **Sign in with Google**.

## Deploy (free, Firebase Hosting)

`firebase.json` and `.firebaserc` are already set up for project `kalpana-pg-app`
(site files from `dist/`, and `firestore.rules` is published on every deploy).

```bash
npx -y firebase-tools@latest login   # one time: opens the browser to sign in
npm run deploy                       # build + upload site + publish Firestore rules
npm run deploy:rules                 # only publish firestore.rules
```

The app is then live at https://kalpana-pg-app.web.app (also
`kalpana-pg-app.firebaseapp.com`); both domains are authorised for Google login
automatically. Invite links created from the live site use that address, so
tenants can open them on any phone. Open the URL on a phone and use *Add to Home
Screen* to install it as an app.

## Data model

Everything for one manager is stored in a single Firestore document
`pgManagers/{uid}`:

```jsonc
{
  "properties": [{ "id": "pg-1", "name": "1" }],
  "rooms": [{ "id": "room-x", "propertyId": "pg-1", "name": "101",
              "capacity": 3, "rent": 8000, "floor": "Ground", "ac": true }],
  "members": [{ "id": "mem-y", "propertyId": "pg-1", "roomId": "room-x",
                "name": "Anita", "phone": "98765xxxxx",
                "joinDate": "2026-01-10", "vacateDate": "", "rentShare": "",
                "notes": "" }]
}
```

Photos, thumbnails and ID-proof chunks live in `pgManagers/{uid}/files/*`
(separate docs, because a Firestore document is limited to 1 MiB). Invite links
are `tenantLinks/{token}` (PG name, rooms and free beds only) with tenant
requests in `tenantLinks/{token}/submissions/{roomId~bed}` and a one-per-account
marker in `tenantLinks/{token}/applicants/{tenantUid}`.

A member counts as **active** when there is no vacate date or the vacate date is
today or later; a bed is **free** when room capacity exceeds active members.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/firebase.js` | Firebase init; detects whether keys are configured |
| `src/AuthContext.jsx` | Google sign-in / sign-out and demo mode |
| `src/store.js` | Load and save data (Firestore or localStorage) |
| `src/utils.js` | Vacancy, occupancy and 30-day notice calculations |
| `src/components/Dashboard.jsx` | Per-PG stats and vacating list |
| `src/components/Rooms.jsx` | Room cards, beds and occupants |
| `src/components/Members.jsx` | Tenant table with search and filters |
