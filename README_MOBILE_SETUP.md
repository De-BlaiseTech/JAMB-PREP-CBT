# V13 — Cloudflare Pages + Firebase backend (mobile-ready)

This package is organized so the student website is hosted by Cloudflare Pages while Firebase provides Authentication, Firestore and the three student Cloud Functions.

## Folder layout
- `site/` — upload/serve this directory with Cloudflare Pages.
- `firebase/` — Firebase backend; GitHub Actions deploys it automatically.

## Cloudflare Pages
Create a Pages project from this GitHub repository.
- Framework preset: None
- Build command: leave empty
- Build output directory: `site`
- Root directory: `/` (repository root)

## Firebase backend
The included workflow deploys Functions + Firestore whenever files under `firebase/` change on `main`.

### Required GitHub secret
Create one repository secret named:
`FIREBASE_SERVICE_ACCOUNT`

Its value must be the complete JSON contents of a Google/Firebase service-account key that has permission to deploy Cloud Functions and Firestore for project `jamb-prep-cbt`.

Do NOT commit the JSON file to the repository.

## Firebase Auth domain
After Cloudflare gives you a `*.pages.dev` address, add that exact domain in:
Firebase Console → Authentication → Settings → Authorized domains.
If you use a custom Cloudflare domain, add that domain too.

## Important
- No OpenAI key is required.
- No Firebase App Check is required.
- Existing Firestore questions stay in the `questions` collection.
- Do not delete the existing Firestore data.
