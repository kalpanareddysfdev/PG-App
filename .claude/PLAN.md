# Bulk room setup + tenant self-registration link

## Context
Setting up a running PG (e.g. 45 rooms, 100 tenants) one record at a time is too slow. Plan: (1) create all rooms in one step from counts ("19 double-share, 16 triple-share"), and (2) send one WhatsApp link so tenants enter their own details and pick their own room/bed. The manager then only reviews and fills rent/dates.

App today: client-only React 19 + Vite + Firebase (Auth + Firestore), no router, no backend. All data lives in one doc `pgManagers/{uid}` (`properties`, `rooms`, `members`); rules are owner-only. Sharing type = `capacity` (no schema change needed).

## Free-only constraint (no paid services)
Everything stays on the Firebase Spark (free) plan: Firestore, anonymous Auth, Hosting. No Cloud Functions (needs paid Blaze plan), no WhatsApp Business API (paid); sharing uses free `wa.me` links. No App Check/reCAPTCHA. Abuse protection is instead: unguessable token, rules validating field size/shape, manager can deactivate the link. Usage (100 tenants ≈ a few hundred writes) is far below the Spark daily quotas (20k writes / 50k reads).

## Part A: Bulk room creation
- New `src/components/BulkRoomsForm.jsx` (Modal, styled like `RoomForm.jsx`, reuse `.form-row`/`.stepper`/chips).
- Inputs:
  1. Sharing rows: `{capacity, count, rent}` (add row: 2-share x 19, 3-share x 16).
  2. Floors: number of floors + rooms per floor (auto-suggested = total / floors, editable per floor); optional ground-floor prefix.
  3. Numbering: floor-based (101, 102.. 201..). Which sharing types go on which floor: default = fill in order, editable in a preview table.
- Live preview table (room no, floor, sharing, rent) before creating; user can tweak any row.
- Generator util `generateRooms(spec, existingRooms)` in `src/utils.js`: skips numbers already in `rooms`, sets `floor` as string.
- New action `bulkAddRooms(list)` in `App.jsx` next to `addRoom`: one `setData`, `newId('room')`, `propertyId: activePg`, toast with undo removing those ids.
- Entry points: `Rooms.jsx` empty state (primary CTA) + toolbar "Bulk add".

## Part B: Tenant self-registration link
**Link type: one common link per PG** (random unguessable token), posted once in the tenants' WhatsApp group. Not one link per tenant (that would mean generating/sending 100 links). Safety comes from: manager can deactivate/regenerate the link (old one stops working), each bed can be claimed only once, and submissions land in a manager inbox for approve/reject.
Rules stay owner-only for `pgManagers`; add a separate public path.

Data (new collection `tenantLinks/{token}`):
- Doc: `{uid, propertyId, pgName, active, rooms:[{id,name,floor,capacity,rent}], claimed:{ "roomId|Bed A": submissionId }}` - a snapshot the manager app writes/refreshes when generating or re-sharing the link.
- Subcollection `submissions/{id}`: `{name, phone, emergencyContact, idNote, roomId, bed, createdAt, imported:false}`.

Rules (`firestore.rules`): public `get` on `tenantLinks/{token}` (unguessable random token, no list); public `create` on submissions with field/size validation; public update on link doc limited to the `claimed` key; owner (`resource.data.uid == request.auth.uid`) full access. Use free Firebase anonymous auth on the public page (enable in console) so rules can require a signed-in visitor.

Tenant page:
- `main.jsx`/`App.jsx`: detect `?join=<token>` (or `/join/<token>`) BEFORE the `!user` Login gate; render new `src/components/JoinForm.jsx` (mobile-first, no login).
- Form: name, phone, emergency contact, ID note; pick floor -> room -> free bed (from `rooms` minus `claimed`). Submit runs a Firestore transaction: check bed still free, set `claimed`, create submission. Clash shows "bed just taken, pick another".
- Check `vite.config.js` PWA `navigateFallbackDenylist`/hosting rewrite so the link loads.

Manager side:
- "Invite tenants" button (Members tab/Dashboard) -> writes/refreshes `tenantLinks/{token}`, shows link, copy + WhatsApp share (add `whatsappShare(text)` next to `whatsappLink` in `src/utils.js`, using `https://wa.me/?text=`). Toggle to deactivate link.
- Inbox: on load, read `submissions where imported == false`, show "N new tenants" banner; "Import" turns each into a member via `actions.addMember` (propertyId, roomId, bed, name, phone, emergencyContact, notes=id) with joinDate = today, rent = room rent, then marks `imported:true`. Manager edits rent/deposit/dates later in existing `MemberForm`/`MemberDetail`. Reject option frees the bed in `claimed`.

## Part C: New member fields (address, photo, ID proof) - free storage
Firebase Storage now needs the paid Blaze plan, so files go in Firestore (free, 1 GiB). The `pgManagers/{uid}` doc has a 1 MiB limit, so files must NOT live inside it.
- Member fields (small, inline): `address`, `photoThumb` (~64px JPEG data URL, ~3KB, for lists), `proofName`, `proofType`, `hasPhoto`, `hasProof`.
- Files in separate docs: `pgManagers/{uid}/files/{memberId}` = `{photo}` (256px JPEG, ~25KB after client-side canvas compression, shown as profile pic) plus `pgManagers/{uid}/files/{memberId}_proof_{n}` chunks (base64 split into ≤400KB pieces, since 1MB file becomes ~1.33MB base64).
- Proof: one file, PDF or image, max 1 MB enforced client-side (type + size check); images downscaled if needed; stitched back on view/download.
- `normalize()` in `store.js` defaults new fields; `MemberForm.jsx` and `MemberDetail.jsx` get address, photo (avatar replaces initials), proof upload/view/replace/remove; deleting a member deletes its file docs.
- Tenant `JoinForm` collects the same fields; uploads go to `tenantLinks/{token}/submissions/{id}` + `files` subcollection (rules cap chunk size); on import the manager app copies them into `pgManagers/{uid}/files`.
- Firestore rules updated for `files` subcollections (owner-only; public create only under active links).

## Files
- New: `BulkRoomsForm.jsx`, `JoinForm.jsx`, `InviteDialog.jsx` (+ small inbox banner component), CSS in `index.css`.
- Edit: `src/utils.js`, `src/App.jsx` (actions, routing, dialogs), `src/components/Rooms.jsx`, `src/store.js` (link/submission helpers), `firestore.rules`, `README.md`.
- Demo mode (no Firebase keys): bulk rooms work; link feature shown as disabled with a note.

## Verification
- Bulk: 19x2-share + 16x3-share over 4 floors -> preview correct, 35 rooms created, numbers unique, undo works, re-running skips existing numbers.
- Link: create link, open in a private window (logged out), submit two tenants for the same bed (second is rejected), confirm submissions appear in manager inbox, import creates members in the right room/bed, occupancy on Rooms tab updates.
- Rules: emulator/manual test that a logged-out user cannot read `pgManagers`, cannot list `tenantLinks`, cannot write outside `claimed`/submissions.
- `npm run build` and lint pass.
