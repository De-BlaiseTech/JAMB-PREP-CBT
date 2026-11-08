# JAMB Prep CBT — Admin Dashboard setup

## Included
- `site/admin.html`: protected admin interface.
- Add, edit, activate/deactivate, search and permanently delete questions.
- Student directory with name, email, registration number, join date, credit balance, subscription status and completed mock count.
- Admin API runs through the existing `/api/index` router, so this does not add another Vercel Serverless Function.

## Required deployment configuration
1. In Firebase Console → Authentication → Users, open the account that should be the administrator and copy its **UID**.
2. In Vercel → Project → Settings → Environment Variables, add:
   - Name: `ADMIN_UIDS`
   - Value: the administrator Firebase UID.
   - For multiple administrators, separate UIDs with commas.
3. Ensure the existing `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable remains configured.
4. Redeploy the project.

Only the UID(s) in `ADMIN_UIDS` can use the admin API. Being signed in is not enough. Do not put administrator UIDs in public frontend JavaScript or grant admin access by changing a Firestore document from the browser.

## Open the dashboard
After deployment, sign in with the configured administrator account and visit `/admin.html`.

## Question format
Each question is saved in the existing Firestore `questions` collection with `subject`, `topic`, `question`, four `options`, numeric `answer` (A=0, B=1, C=2, D=3), `explanation`, and `active`. Students continue to receive only active questions through the existing question-bank query. Admin changes use Firebase Admin SDK on the server and do not weaken the existing Firestore client rules.

## Student visibility
The dashboard lists up to the latest 500 user records and shows aggregate counts from each student's `results` and `mockStarts` subcollections. The directory is read-only; it does not expose passwords or authentication tokens.


## Important preview note
The admin dashboard depends on Firebase Authentication and the protected `/api/admin` endpoint. A local editor preview (for example, SPCK's file preview) does not provide the Vercel API or its server environment variables. Deploy the project to Vercel with the project Root Directory set to `site`, then open `https://YOUR-DOMAIN/admin.html`. If the page cannot load its scripts, it now displays a diagnostic message instead of failing silently.
