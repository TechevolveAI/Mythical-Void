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

The private static preview alone cannot prove cross-device access to existing protected portraits: its network boundary excludes the legacy media service. Qualify those reads separately through a protected candidate gateway, real development accounts and private media storage. Keep this acceptance item distinct from local emulator verification and from email delivery. Do not enable production accounts until that complete private route has been exercised.

Rollback: disable the frontend flag and the account endpoint's flag. Local adventures keep working. Retain chosen online copies unless the adult requests deletion. Preserve the prior development Auth configuration and deployed service revision when changing them. Do not change production, Sensei or Tech Evolve settings as part of this development setup.

## Verification recorded on 23/10/2026

The candidate passed 398 Jest suites (6,529 tests), 15 Auth/Firestore emulator integration tests, and the real-SDK two-browser phone journey. Builds with accounts disabled and enabled succeeded. The new server's production dependency audit reported no known vulnerabilities.

Development Firebase email links and the limited runtime identity are configured. Cloud Build `4b9d1843-1e10-426b-a3b2-cda4ad286859` produced image digest `sha256:eeac795e28fa7472fc72941e1e0de1082a4701a4673f0ae8f0ebc6e3f291b70d`. Service `mythical-void-adult-accounts-dev` passed a real Google integration check for authentication, adult declaration, save/read, revision conflict, account deletion and rejected stale tokens. Its synthetic account and records were removed; no email was sent. These checks do not establish inbox delivery or physical-device acceptance.

The account API accepts HTTP connections but requires Firebase verification for every account operation. This is separate from the game preview, whose existing IAP access remains protected. Its only allowed browser origin is the exact development preview. Cloud Run reserves some external paths ending in `z`, so external health checks use the authenticated API's expected signed-out 401 response instead of `/healthz`.

## Release preparation on 24/10/2026

Kevin subsequently confirmed that email sign-in and switching devices worked on his phone and explicitly authorised production Firebase configuration, push, merge and deployment. The acceptance gate described below is now complete. The production setup uses only `mythical-void-prod`, linked to the existing Mythical Void billing account. Its new default Firestore database is native Firestore in `europe-west1`, with deletion protection and browser rules that deny all direct access. Its separate production web app uses `mythical-void-prod.firebaseapp.com` and authorises `mythicalvoid.com`; email links and email enumeration protection are enabled.

`cloudbuild.prod.yaml` builds the same seven backend runtime files with a pinned Google Docker builder and a ten-minute timeout. The dedicated production runtime has only the two Auth user permissions and database-scoped Firestore access. The separate build identity can read its source bucket, write build logs and publish to its own image repository. Both build buckets are private and located in Belgium. Production service checks, required CI and publication verification are recorded in the release evidence; configuration alone does not establish a completed release.

Remote `main` still pointed to gameplay baseline `00241ae955a37b34ac60275378a41575b203f622` at the release check. The live Netlify deployment was `6adb8e10ce691a181f55c60f`. The account candidate has not been pushed, merged or published. Kevin is testing real email delivery and device switching; his confirmation is the release gate.

The refreshed IAP preview uses the unchanged `7b9243d2` game payload. Its 240 delivery files were verified; IAP, IAM and instance limits were preserved. The window ends at **04:11 Dublin time on 24/10/2026**. This is a time-limited test address, not the production release.

Production preflight confirmed project `mythical-void-prod`, number `585326384593`. Its Firebase Management, Authentication, Firestore and Cloud Run API reads returned `SERVICE_DISABLED`. Production account services therefore still need configuration after acceptance. A disabled API does not prove that its underlying project data is empty: inspect existing database location and type after enabling the API, and never convert or replace an existing database to fit this release.

The prepared account service name is `mythical-void-adult-accounts-prod` in `europe-west1`. Its planned deterministic origin is `https://mythical-void-adult-accounts-prod-585326384593.europe-west1.run.app`, now included in the browser connection policy. Verify the deployed service's URL against that value before activation. Google documents the deterministic URL format in [Invoke with an HTTPS request](https://docs.cloud.google.com/run/docs/triggering/https-request). Adding Firebase to the existing project uses the [Firebase Management setup workflow](https://firebase.google.com/docs/projects/use-firebase-with-existing-cloud-project).

After Kevin confirms the private email and device test:

1. Recheck remote main and the published deployment against the recorded baseline. Preserve the current production flags, published deploy and service revisions for rollback.
2. Enable the required account services only in `mythical-void-prod`. Register or reuse its own Firebase web app, enable email links and authorise `mythicalvoid.com`, preserving unrelated Auth settings. Do not copy development identities or adventures into production.
3. Inspect the production database. Use a Belgium native Firestore database with browser access denied. Create the limited account runtime identity: database-scoped `roles/datastore.user`, plus only `firebaseauth.users.get` and `firebaseauth.users.delete`. Match the database actually selected; do not grant a project-wide data role or change other applications' IAM.
4. Build the same backend source in the production project and deploy the account service with minimum zero, maximum one instance, one CPU, 512 MiB and a 30-second request timeout. Allow only the canonical game origin in CORS. Require verified Firebase tokens and adult declaration for every account operation. Supply the existing public anonymous-media key without exposing it in logs.
5. Verify signed-out and wrong-origin denial, synthetic save/read/revision conflict and deletion using the production service. Supply the resulting production Firebase web identifiers and exact service URL to the frontend build and the Netlify media bridge. Keep the public UI switch off until these checks pass.
6. Push the prepared branch, open the PR and run all required CI: optional Firebase accounts, onboarding and the three gameplay jobs. Merge only the passing, reviewed source. Build the final frontend from the merged commit with the production settings and release identifier.
7. Publish the verified static bundle and all eight function packages. Two media packages change; the other six are preserved from production. Verify the archive contents and imports, retain `invocationMode: stream` and `buildData.runtimeAPIVersion: 2`, and use the existing sealed-deployment guard so the CLI cannot silently repackage them. Compare uploaded digests and schedules with the manifest.
8. Confirm the published source, gameplay entry, optional email route, account save/continue and protected media reads. Keep real email delivery and physical phone acceptance separate from synthetic service checks. Retire temporary verification drafts and remove their synthetic records.

Rollback publishes the previous verified game bundle and disables the production frontend, account API and media-bridge account switches. Preserve adult-created account copies for recovery; do not delete them as a deployment rollback. Ordinary local adventures and the existing anonymous media route remain available.

The repeatable media check is `scripts/review/test-adult-media-transfer.cjs --live-development`. It requires an explicitly protected, expiring candidate draft, public development Firebase settings, the public anonymous-media key and local synthetic PNG/MP4 fixtures. The private access token stays in the process environment. It creates only tagged anonymous media identities and `example.test` Firebase users, launches Chrome with `--mute-audio`, closes its browser/server and removes its run-owned data in cleanup. It is not an unattended CI job and must never be pointed at a public production account service.

The check passed all 12 cases against the protected hosted candidate, real development Firebase Auth/Firestore and private legacy media storage. The original anonymous owner and the same adult on a second phone-sized browser could open the portrait and film. The image decoded; the four-second, 1280-pixel-wide film advanced during muted playback. Local adventures survived the import, temporary URLs were stripped and fresh signed URLs were obtained. Another account, copied references with the wrong anonymous owner, unsaved references, invalid tokens and signed-out access were denied. The account route rejected generation requests. No email or AI generation was requested. The successful run's two Firebase users, two anonymous identities, two jobs and two files were removed.

The 40 focused account tests and the account-disabled production build passed again. Both changed media function archives passed isolated import and disabled-feature checks, included the account bridge and excluded review fixtures. The other six production function archives remain byte-identical. Earlier full-regression and emulator results still apply to the unchanged application code; remote CI and production service smoke checks remain part of the release sequence above.
