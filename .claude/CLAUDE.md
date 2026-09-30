# PG Manager App

A mobile-first React app for managing paying guest (PG) hostels: rooms, tenants, occupancy, rent tracking, and document uploads.

## Stack
- **Frontend:** React 19, Vite 8, lucide-react icons, plain CSS (~1,600 lines)
- **Database:** Firebase Firestore (Spark/free plan)
- **Auth:** Firebase Authentication (Google OAuth, anonymous login for tenant forms)
- **Hosting:** Firebase Hosting (SPA)
- **Build:** `npm run dev`, `npm run build`, Vite + oxlint

## Data model
One Firestore doc `pgManagers/{uid}` holds everything for an authenticated user:

```javascript
{
  properties: [{ id, name, address? }],
  rooms: [{ id, propertyId, name, floor, capacity, rent, amenities[], ac }],
  members: [{
    id, propertyId, roomId, bed, name, phone, joinDate, vacateDate,
    rentShare, deposit, rentPaidMonth[], emergencyContact, notes,
    // Phase 2: add address, photoThumb, proofName, proofType, hasPhoto, hasProof
  }]
}
```

Files (photos, ID proofs) are stored in separate Firestore docs to stay within the 1 MiB document limit:
- `pgManagers/{uid}/files/{memberId}` → `{photo}` (256px JPEG, ~25KB)
- `pgManagers/{uid}/files/{memberId}_proof_{n}` → chunks of base64 (≤400KB each)

## Key files

### Core
- **`src/App.jsx`** — Main app, auth gate, data loading/saving, central `actions` object
- **`src/AuthContext.jsx`** — useAuth hook, signIn/signOut/demoMode
- **`src/store.js`** — normalize() validates data shape, newId() generates IDs
- **`src/utils.js`** — helpers: sharingLabel, whatsappLink, bedLabel, roomOccupancy, etc.
- **`src/firebase.js`** — Firebase config and Firestore refs
- **`src/media.js`** — Image compression, file chunking for Firestore (phase 2)

### Components
- **`Rooms.jsx`** — List, filter, occupancy cards, "Add room" / "Bulk add"
- **`RoomForm.jsx`** — Single room creation form (reused template for bulk)
- **`Members.jsx`** — Member list, search, filter by room/status
- **`MemberForm.jsx`** — Single member creation/edit, rent tracking
- **`MemberDetail.jsx`** — Member profile, WhatsApp link, proof viewer (phase 2)
- **`Dashboard.jsx`** — Landing tab, stats, invite link banner (phase 2)
- **`Modal.jsx`** — Generic modal wrapper
- **`ConfirmDialog.jsx`** — Delete/reject confirmations
- **`Login.jsx`** — Auth screen

### CSS
- **`src/index.css`** — Reusable `.form-row`, `.stepper`, `.chip` classes; mobile-first

### Config
- **`firestore.rules`** — Owner-only access on `pgManagers/{uid}` (extended in phase 2 for public tenant links)
- **`vite.config.js`** — PWA config, build settings

## Development

### Deploy
Always deploy with `./quick-deploy.sh` (project root), and only when the user explicitly asks. It auto-commits all changes as "Deploy: <timestamp>", runs `npm run deploy` (build + firebase deploy), and goes live at https://pg-manager-pgmaaya.web.app.

### Add a room
Rooms.jsx → "Add room" → RoomForm → actions.addRoom (stores room and room number uniquely, unless app was in manual mode and the number was not de-duped)

### Add a tenant
Members.jsx or Rooms.jsx → "Check in" → MemberForm → actions.addMember (picks first free bed)

### View tenant details
Members.jsx → click tenant → MemberDetail (shows profile, rent, documents)

### Demo mode
If `VITE_FIREBASE_*` env vars are blank, the app uses localStorage instead of Firestore. Bulk and tenant-link features show as "disabled in demo".

## Phases (roadmap)

### Phase 1 (done)
- Single room/tenant creation
- Manual rent tracking
- WhatsApp links

### Phase 2 (in planning)
1. **Bulk room creation** — BulkRoomsForm, floor-based numbering (101, 102…)
2. **Tenant self-registration** — JoinForm on a public link (one per PG), submissions inbox
3. **Member fields** — address, photo (profile pic), ID proof (PDF/image, ≤1MB)
4. **File storage** — Firestore docs (no Firebase Storage; stays free tier)
5. **Admin inbox** — Pending submissions, approve/reject/import

## Testing
- No test framework set up yet; manual testing in dev or staging
- Verify Firestore rules: `firebase emulator:start`
- Build: `npm run build` (check size, lint)
- PWA: check manifest and `navigateFallbackDenylist` in vite.config.js for public links

## Constraints
- **Free tier only** — no Blaze plan, no Cloud Functions, no Firebase Storage, no email/SMS/WhatsApp APIs
- **Client-side only** — no backend; all logic in React and Firestore rules
- **1 MiB document limit** — files must be in separate docs
- **500ms debounce on save** — avoid hammering Firestore on rapid edits
