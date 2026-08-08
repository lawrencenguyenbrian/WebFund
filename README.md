# WebFund

A crowdfunding platform built with **vanilla JavaScript + Firebase** (Firestore, Auth, Hosting). Founders post projects and call for funding; investors pledge money via manual bank transfer; admins review and confirm every step — no server code, no payment gateway, real money never touches the platform.

All UI text is in Vietnamese (`vi`).

---

## Features

- **Project feed** — browse approved projects, filter by category/stage, sort by trending / ending soon / newest. Paid *featured* listings sort to the top with a ⭐ badge.
- **Project creation** — multi-step form with cover image & gallery (Cloudinary upload), milestones, team, strategies, and a **Gemini-powered AI Pitch Helper** that drafts your name/tagline/description (review-before-apply).
- **Editing** — founders edit their own projects; status and funding are preserved.
- **Pledging** — investors pledge a fixed amount or a skill. Pledges start `pending`; an admin confirms them after the bank transfer clears, which increments the project's `raised`.
- **Admin console** (`admin.html`) — review projects, confirm/reject pledges, handle delete requests, approve payouts, approve featured listings, and view/restore deleted projects.
- **Monetization** (real-world modeled, no payment custody):
  - **Platform fee** — when a project is fully funded, the founder requests a payout; they must settle a 5% platform fee (transferred manually), which an admin confirms before the project is marked "Đã rút vốn".
  - **Featured listings** — founders pay 200.000₫ for 7 days of prominence; an admin approves the request.
- **Roles** — `founder`, `investor`, `admin`. Self-service only up to `founder`/`investor`; the `admin` role can only be granted by an existing admin.
- **Dark-themed, responsive UI** with Bootstrap 5 + Bootstrap Icons.

---

## Tech Stack

| Layer       | Technology                                        |
|-------------|---------------------------------------------------|
| Frontend    | HTML, CSS, Vanilla JS (no build step / framework) |
| UI          | Bootstrap 5.3, Bootstrap Icons                    |
| Backend     | Firebase (Firestore, Auth, Hosting)               |
| Auth        | Email/password + Google sign-in                   |
| Images      | Cloudinary unsigned uploads                       |
| AI          | Gemini `generateContent` API (AI Pitch Helper)    |

---

## Project Structure

```
.
├── HTML/            # All pages
│   ├── main.html         # Public project feed
│   ├── auth.html         # Login / register
│   ├── select-role.html  # Pick founder / investor after sign-up
│   ├── post-project.html # Create / edit a project (+ AI helper)
│   ├── project.html      # Project detail + pledge CTA
│   ├── pledge.html       # Make a pledge
│   ├── my-projects.html  # Founder's projects (updates, delete, payout, feature)
│   ├── portfolio.html    # Investor's pledges
│   ├── settings.html     # Profile / role / theme
│   ├── admin.html        # Admin console
│   ├── seed.html         # Seed 12 demo projects
│   └── 404.html
├── JS/               # Page scripts (vanilla, DOMContentLoaded-driven)
├── CSS/              # Per-page styles
├── firestore.rules   # Security rules (authorization is enforced server-side)
├── firebase.json     # Hosting + Firestore rules config
└── .firebaserc       # Firebase project id (default: web-fund-139cb)
```

---

## Getting Started

### 1. Prerequisites

- A [Firebase](https://firebase.google.com) project on the free Spark plan
- Node.js 18+ (only needed for the Firebase CLI)
- A Gemini API key (free at [Google AI Studio](https://aistudio.google.com/apikey)) for the AI Pitch Helper
- (Optional) A [Cloudinary](https://cloudinary.com) cloud name + unsigned upload preset for image uploads

### 2. Clone & configure

```bash
git clone <your-repo-url>
cd WebFund
```

Replace the Firebase config in `JS/firebase-config.js` (and `HTML/seed.html`) with your own project's web-app config:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Gemini API key (AI Pitch Helper)

The key lives in a gitignored file so it's never committed:

```bash
cp JS/config.local.example.js JS/config.local.js
# then edit JS/config.local.js and paste your key
```

```js
const GEMINI_CONFIG = {
  apiKey: "YOUR_GEMINI_API_KEY",
  model: "gemini-3-flash-preview"
};
```

### 4. Enable Firebase services

1. **Authentication** — enable *Email/Password* and *Google* providers.
2. **Firestore** — create a database, then deploy the security rules:
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```
3. **Hosting** (optional) — deploy the site:
   ```bash
   npx firebase-tools deploy --only hosting
   ```
   The app entry point is `HTML/main.html` (the root has no `index.html`).

### 5. Grant yourself admin

The rules deliberately prevent users from self-promoting to `admin`. In the Firebase console → Firestore → `users/<your-uid>`, set `role: "admin"`.

### 6. Seed demo data (optional)

Open `HTML/seed.html` in your browser and click **Bắt đầu seed** to insert 12 demo projects.

### 7. Run locally

```bash
npx firebase-tools serve --only hosting
```

---

## Data Model

### `users/{uid}`
`name`, `email`, `role` (`founder` | `investor` | `admin`), `createdAt`, `verified` (admin-only), public profile: `bio`, `location`, `website`, `socialLinks` (`facebook`, `linkedin`), `avatarUrl` (Cloudinary, folder `webfund/avatars`)

### `projects/{projectId}`
`userId`, `userName`, `name`, `tagline`, `desc`, `stage`, `category`, `tags`, `goal`, `raised`, `status` (`pending` | `approved` | `rejected`), `coverImage`, `gallery`, `milestones`, `team`, `useOfFunds`, `email`, `socialLinks`, `strategies` (`crowdfund` | `skill`), `perkTiers` (`{id, minAmount, title, description, durationMonths}` — `durationMonths: null` = non-expiring), `deadline` (Timestamp), `daysLeft` (static fallback for legacy projects), `createdAt`

**Workflow fields (admin-controlled):**
- `deleteRequested` / `deleteRequestedBy` — founder asks to delete; admin approves (doc moves to `deletedProjects`) or rejects (clears the fields)
- `payoutRequestedAt` — founder requests payout when `raised >= goal`
- `payoutStatus: "paid"` + `feeAmount` + `payoutConfirmedAt` — set by admin after the platform fee is received
- `featuredRequested` — founder pays to feature
- `featured: true` + `featuredUntil` — set by admin for 7 days

### `projects/{projectId}/updates/{updateId}`
Founder progress posts: `title`, `content`, `createdAt`

### `pledges/{pledgeId}`
`userId`, `userName`, `userEmail`, `projectId`, `projectName`, `amount`, `method` (`bank_transfer` | `skill`), `skill`, `wantsPerk`, `perkTier`, `note`, `status` (`pending` | `confirmed` | `rejected`), `createdAt`. Pledges are never deleted. Confirming a perk pledge sets `perkGrantedUntil` on the user.

### `verificationRequests/{uid}`
One doc per user (doc id = user's uid). `userId`, `userName`, `userEmail`, `idPhotoUrl`, `status` (`pending` | `approved` | `rejected`), `submittedAt`. `idPhotoUrl` is transient — it is uploaded to Cloudinary (folder `webfund/verification`) and stripped with `FieldValue.delete()` in the same transaction as the admin approve/reject, so no ID image persists after review. No OCR/document data is stored.

### `deletedProjects/{projectId}`
Audit copy of a deleted project + `deletedAt`, `deletedBy`, `deletedByEmail`, and (when restored) `restoredAt`, `restoredBy`.

---

## Security Model

All authorization is enforced in `firestore.rules` — client-side UI checks are only cosmetic.

- **Anyone signed in** can read user profiles (founder/investor names).
- **Users** create/update their own doc with `role` limited to `founder`/`investor`; only an existing `admin` (checked via a `get()` on `users/{uid}`) can grant `admin`.
- **Projects** are publicly readable when `status == "approved"`; owners/admins read everything. Creation requires `status == "pending"`, `raised == 0`, owned by the caller. Owners may edit content and signal delete/payout/feature requests, but **cannot** change `status`, `raised`, `userId`, `payoutStatus`, `feeAmount`, `featured`, or `featuredUntil`. Deletes are admin-only (with audit copy).
- **Pledges** are readable by their owner or admins; creation is self-only and always `pending`; only admins confirm/reject (amount/project/user immutable); deletion is forbidden.
- **`verificationRequests`** are readable by their owner or admins; users create only their own doc with `status == "pending"` and may re-apply only from `rejected` → `pending`; only admins flip status to `approved`/`rejected`. `users.verified` is admin-only (owner updates must leave `verified` unchanged).
- **`deletedProjects`** is an admin-only audit log.

---

## Config Files

| File                          | Purpose                                             | Committed? |
|-------------------------------|-----------------------------------------------------|------------|
| `JS/config.local.js`          | `GEMINI_CONFIG` (your API key)                      | No (`gitignore`d) |
| `JS/config.local.example.js`  | Template with placeholder key                       | Yes        |
| `JS/firebase-config.js`       | Firebase web-app config (public by design)          | Yes        |
| `JS/post-project.js`          | `CLOUDINARY_CONFIG` (cloud name + upload preset)    | Yes        |
| `firestore.rules`             | Server-side authorization                           | Yes        |

---

## Notes & Caveats

- This is a **learning/demo project**: bank transfers are manual, and "fees" are modeled as admin-confirmed bookkeeping. No real payment processing is performed.
- The Firebase web `apiKey` is public — that's expected for Firebase apps; real protection comes from the security rules and per-service restrictions.
- The AI Pitch Helper calls the Gemini API directly from the browser, so the key is exposed to page visitors. Keep it to a demo key with tight quota limits.
