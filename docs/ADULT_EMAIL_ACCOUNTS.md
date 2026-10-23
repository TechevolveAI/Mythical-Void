# Optional adult accounts with Firebase

This candidate adds optional email-link sign-in for adults aged 18 or over. It starts from the published gameplay baseline `00241ae9`. The feature remains disabled unless its explicit frontend and backend switches and Firebase settings are supplied. It is separate from the existing anonymous media identity and optional legacy Cloud Save.

## Player journey

Open **Your adventures → Save across devices**. Confirm the adult age range, enter an email and request a sign-in link. The same form creates an account or signs into an existing one. Opening a link confirms the email; another browser can ask for the address again. There are no passwords or numeric codes to manage. Only adventures explicitly added to the account are uploaded. Continued progress then saves automatically.

A fresh device offers the saved creatures before requiring another hatch. Opening an online adventure creates a new local copy and preserves existing local adventures. Sign-out and removal of online copies do not remove local saves. Conflicting updates from two devices are kept separate rather than silently overwriting progress. Keep playing and Escape close the account panel during errors or pending requests.

Profiles marked under 18 receive no email form and do not initialise Firebase Auth. An adult who has not opted in does not start the Auth SDK on game load. No account is required to play.

## Google boundary

Development belongs only to `mythical-void-dev-eu`; production activation is separate. Reuse its existing Firebase web app. Firebase Authentication handles verified email-link identities. The Cloud Run service verifies Firebase ID tokens, revoked sessions and adult declarations. Firestore stores account declarations and chosen adventure snapshots under `adultAccounts/{uid}` in the existing Belgium default database. Browser Firestore access is denied; only the limited service identity accesses the database. This does not establish an EU-only residency guarantee for Firebase Authentication.

The server never receives an account ID from the browser as authority. It derives the ID from the verified token. It accepts only configured origins. Passwordless email auth also uses Firebase's `password` provider identifier; unverified and anonymous tokens are rejected. Firebase's email enumeration protection stays enabled.

No email identity or Firebase sign-in token goes to Supabase. Existing creature portraits and films remain in their existing anonymous media store. A legacy anonymous token is verified against that store only to record an anonymous media-owner ID. A protected media read must match both an asset reference in the saved adventure and its original anonymous owner. The existing Netlify gateway obtains this authorisation from Google. New artwork still uses the anonymous generation path.

## Integrity and deletion

Account saves remove device safety profiles, guardian PINs, local safety history, sessions, email fields and expiring media URLs. One-time email-link credentials are removed from the URL by the first page script, before analytics or other scripts start. A short-lived email hint stays outside game snapshots while a link is pending; Firebase's separate browser session persists until sign-out.

Each account can hold 50 active adventures. Each snapshot is limited to 2 MiB and split into 256 KiB chunks to stay below Firestore's per-document limit. Chunks, metadata and revision advance in one transaction. The snapshot digest and operation ID support safe retries after lost responses. Tombstones stop old devices from recreating removed copies.

Account deletion requires a sign-in within five minutes. Writes are fenced first, then adventure documents and payload chunks are erased and the Firebase user is deleted. An interrupted deletion can be retried. A minimal UID/deletion-time marker remains to prevent delayed requests recreating data; provider backups and service/security logs have separate retention. Existing local copies and separately owned anonymous media are not erased by this action. The in-game privacy notice explains these boundaries.

## Local verification

Use Node 22, Java 21 and the root and backend lockfiles. No live email or cloud account is needed:

```sh
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix cloudrun/adult-accounts
npm run test:adult-accounts
npm run test:firebase-accounts
MYTHICAL_BROWSER_CHANNEL=chrome npm --prefix cloudrun/adult-accounts run test:browser
npm test -- --silent
npm run build:onboarding-ci
```

The emulator commands force project `demo-mythical-adult`, localhost Auth/Firestore and synthetic `example.test` addresses. The browser regression launches isolated phone-sized browsers with `--mute-audio`, uses the real Firebase Web SDK and cleans up its processes. It checks under-18 exclusion, sign-in persistence, two-device continuation, local-copy preservation, offline closure and sign-out. An image for private review is written under `.visual-review/adult-firebase/`.

The CI workflow repeats the focused tests, emulator transactions and phone browser journey. It requires no Google credentials. It does not send real emails or test provider-generated artwork.

## Development deployment

Keep the game frontend switch off until its account service is configured and tested. Use the existing Mythical Void development build identity, source/log buckets and `private-review` image repository. The checked-in Cloud Build configuration caps one build at ten minutes; `.gcloudignore` restricts the uploaded context to the seven backend files needed by Docker. No local environment, email data, service-account key or node_modules is uploaded.

The account runtime requires a dedicated service account with Firestore data access restricted to the default development database, plus only `firebaseauth.users.get` and `firebaseauth.users.delete` for identity verification/deletion. It must not have Auth configuration or project administrator permissions. Google supplies runtime credentials; do not download a private key. Keep minimum instances zero, maximum instances one and request timeout 30 seconds for development.

Enable Firebase email links (`signIn.email.enabled=true`, `passwordRequired=false`) only in this development project, preserving anonymous sign-in and existing authorised domains. Add the exact private preview hostname. Firebase's default sender can be used for the initial private check; inbox delivery and return through the protected preview still require an adult's real email test.

Frontend public configuration is listed in `.env.example`. `VITE_ENABLE_ADULT_ACCOUNTS=true` and `VITE_ADULT_ACCOUNT_API_URL` enable the UI for a specific build. The Google server needs `ENABLE_ADULT_ACCOUNTS=true`, `GOOGLE_CLOUD_PROJECT`, explicit `ADULT_ACCOUNT_ALLOWED_ORIGINS`, and the existing public legacy media key. The Netlify read bridge separately needs `ENABLE_ADULT_ACCOUNTS=true` and `ADULT_ACCOUNT_API_URL`. Its endpoint must be the reviewed Mythical Void Cloud Run account service. Add only the exact account origin and Firebase Auth endpoints to CSP.

The private static preview alone cannot prove cross-device access to existing protected portraits: the media bridge must also be available in that preview's routing. Keep this acceptance item distinct from local emulator verification and from email delivery. Do not enable production accounts until the full private route has been exercised.

Rollback: disable the frontend flag and the account endpoint's flag. Local adventures keep working. Retain chosen online copies unless the adult requests deletion. Preserve the prior development Auth configuration and deployed service revision when changing them. Do not change production, Sensei or Tech Evolve settings as part of this development setup.

## Verification recorded on 23/10/2026

The candidate passed 398 Jest suites (6,529 tests), 15 Auth/Firestore emulator integration tests, and the real-SDK two-browser phone journey. Builds with accounts disabled and enabled succeeded. The new server's production dependency audit reported no known vulnerabilities.

Development Firebase email links and the limited runtime identity are configured. Cloud Build `4b9d1843-1e10-426b-a3b2-cda4ad286859` produced image digest `sha256:eeac795e28fa7472fc72941e1e0de1082a4701a4673f0ae8f0ebc6e3f291b70d`. Service `mythical-void-adult-accounts-dev` passed a real Google integration check for authentication, adult declaration, save/read, revision conflict, account deletion and rejected stale tokens. Its synthetic account and records were removed; no email was sent. These checks do not establish inbox delivery or physical-device acceptance.

The account API accepts HTTP connections but requires Firebase verification for every account operation. This is separate from the game preview, whose existing IAP access remains protected. Its only allowed browser origin is the exact development preview. Cloud Run reserves some external paths ending in `z`, so external health checks use the authenticated API's expected signed-out 401 response instead of `/healthz`.
