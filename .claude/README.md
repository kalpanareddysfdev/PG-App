# PG Manager App — Implementation Guides

This folder contains planning and reference docs for the PG Manager app.

## Files

- **`PLAN.md`** — Detailed implementation plan for phase 2: bulk room creation, tenant self-registration link, member file uploads (address, photo, proof)
- **`CLAUDE.md`** — Project architecture, data model, key files, development workflow, and constraints
- **`README.md`** — This file

## Implementation checklist

### Phase 2A: Bulk room creation
- [ ] Create `src/components/BulkRoomsForm.jsx` — form for sharing counts, floors, numbering
- [ ] Add `bulkAddRooms(list)` action in `src/App.jsx`
- [ ] Import `generateRooms()` from `src/lib/roomGenerator.js` (already created)
- [ ] Update `src/components/Rooms.jsx` — add "Bulk add" button in toolbar and empty state
- [ ] Test: 19×2-share + 16×3-share over 4 floors → 35 rooms, no duplicates, undo works

### Phase 2B: Tenant self-registration link
- [ ] Create `src/components/JoinForm.jsx` — public tenant form (no login required)
- [ ] Create `src/components/InviteDialog.jsx` — manager side, generate/share/revoke link
- [ ] Update `src/App.jsx` — detect `?join=<token>` or `/join/<token>` before login gate
- [ ] Update `src/utils.js` — add `whatsappShare(text)` alongside `whatsappLink()`
- [ ] Update `firestore.rules` — add public access to `tenantLinks/{token}` collection
- [ ] Test: create link, submit two tenants to same bed (second rejected), import one to member

### Phase 2C: Member fields and file uploads
- [ ] Update member schema: `address`, `photoThumb`, `proofName`, `proofType`, `hasPhoto`, `hasProof`
- [ ] Update `src/store.js` — add defaults in `normalize()`
- [ ] Update `src/components/MemberForm.jsx` — add address input, photo/proof upload
- [ ] Update `src/components/MemberDetail.jsx` — show photo as avatar, proof viewer/manager
- [ ] Use `src/lib/fileHelpers.js` (already created) for compression and chunking
- [ ] Update `firestore.rules` — add `pgManagers/{uid}/files/*` subcollection rules
- [ ] Test: upload 1 MB PDF, image, see storage estimates

### Phase 2D: Tenant inbox
- [ ] Add `src/components/SubmissionsInbox.jsx` — list pending tenant forms
- [ ] Update `src/components/Dashboard.jsx` or Members tab — show "N new tenants" banner
- [ ] Implement import flow: approve/reject, copy to `pgManagers/{uid}/members`
- [ ] Update member import to copy files from `tenantLinks/{token}/files` subcollection

## Quick refs
- **Room generator:** `src/lib/roomGenerator.js` — `generateRooms(spec, existingRooms)`
- **File helpers:** `src/lib/fileHelpers.js` — `compressImage()`, `chunkBase64()`, `validateFile()`
- **CSS classes to reuse:** `.form-row`, `.stepper`, `.chip` in `src/index.css`
- **Components to reference:** `RoomForm.jsx` (UI template), `Modal.jsx`, `ConfirmDialog.jsx`
- **Demo mode check:** `isFirebaseConfigured` in `src/firebase.js`

## Notes
- All features use the Firebase free tier (Spark plan)
- Firestore limit: 1 MB per document → files in separate subcollections
- No Cloud Functions, no Firebase Storage, no backend
- Tests: run in emulator for rules, manual test for UI
