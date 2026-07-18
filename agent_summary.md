## Goal
- Build a Bootstrap-based "WebFund" crowdfunding platform with Firebase Auth + Firestore, per-page CSS/JS files, and dynamic project data.

## Constraints & Preferences
- App must use Bootstrap 5.3 (CDN, dark/light mode via `data-bs-theme`)
- Vietnamese language throughout
- Fonts: Inter (body), Space Grotesk (headings), JetBrains Mono (monospace) via Google Fonts
- Firebase Authentication (Email/Password + Google) and Firestore replace localStorage for auth and projects
- Each page gets its own HTML, JS, and CSS file: `main.html` + `main.css` + `main.js`, `auth.html` + `auth.css` + `auth.js`
- Files organized in `CSS/`, `HTML/`, `JS/` folders

## Progress
### Done
- Restructured project into `CSS/`, `HTML/`, `JS/` folders
- `HTML/main.html` — main landing page with hero, terminal dock, project feed, features, CTA, footer, and create-project modal
- `HTML/auth.html` — combined login/register page with Bootstrap pill tabs, Google sign-in button, terminal dock
- `CSS/main.css` — all main-page dark mode overrides, typography, navbar styles, project-card styles, cursor-blink animation
- `CSS/auth.css` — auth-specific gradient background, card, tab, terminal, and dark form-control styles
- `JS/firebase-config.js` — Firebase init with user's project config
- `JS/auth.js` — Firebase Auth logic: `onAuthStateChanged` redirect guard, email/password login & register, Google sign-in via popup, user save to Firestore `users/{uid}`, Vietnamese error messages
- `JS/main.js` — full main page logic: Firebase Auth `onAuthStateChanged` drives auth UI (show/hide user menu, create button, login/register buttons), Firestore project CRUD, project feed with filter/sort, hero stats (project count, user count from Firestore, funded count)
- Firebase CDN scripts (compat SDK v10.7.1) and Bootstrap JS bundle added to both HTML files
- Removed hardcoded default project seed data
- Removed case study section; removed emoji icons from auth page; removed fake partner section
- Re-added terminal dock to both auth and main pages after user requested it back
- Replaced English words in Vietnamese text with natural Vietnamese equivalents
- Changed "nhà đầu tư đang hoạt động" to "người dùng đã đăng ký" (counts Firestore `users` collection)
- Separated `createProjectBtn` from `authButtons` div so it can show independently when logged in
- **Fixed login/register buttons visible after login bug:**
  - Root cause: `d-flex` class on `#authButtons` applies `display: flex !important` via Bootstrap, overriding inline `style.display = 'none'`
  - Removed `d-flex` from HTML; JS manages display directly with `display: 'none'` / `display: 'flex'`
  - Replaced `getSession()` / `currentUser` variable with direct `firebase.auth().currentUser` calls (synchronous, more reliable)
  - `initAuthUI()` now called on `DOMContentLoaded` AND on each `onAuthStateChanged` fire

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Migrated from localStorage to Firebase (Auth + Firestore) for real auth and data persistence
- Used Firebase compat SDK (CDN) instead of modular SDK to avoid needing a bundler
- Combined login + register into a single `auth.html` using Bootstrap pill tabs
- Firestore `users/{uid}` collection tracks registered users for account count in hero stats
- Google sign-in uses `signInWithPopup` with error supression for `popup-closed-by-user`
- Use `firebase.auth().currentUser` synchronously instead of caching in a variable
- Removing `d-flex` from HTML to avoid Bootstrap `!important` overriding inline display changes
- Each page gets its own CSS/JS to keep concerns isolated; shared Firebase init is extracted into `firebase-config.js`

## Relevant Files
- `HTML/main.html` — main landing page
- `HTML/auth.html` — login/register page
- `CSS/main.css` — main page styles
- `CSS/auth.css` — auth page styles
- `JS/main.js` — main page logic (Firestore, auth UI, project feed)
- `JS/auth.js` — auth page logic (Firebase Auth, Google sign-in, user save)
- `JS/firebase-config.js` — Firebase initialization
