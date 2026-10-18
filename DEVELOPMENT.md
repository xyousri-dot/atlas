# Atlas: test first, release separately

- Customer GitHub Pages site uses `main`. Do not push or merge there without explicit release approval.
- Development pushes use `atlas-pilot/**`; GitHub Actions runs core checks and browser smoke checks.
- Vercel project: **atlas-phone-pilot**, team **xyousri-9529s-projects** only.
- Git-connected deployments must be **Preview**. `main` deployments are disabled in vercel.json; the build also refuses `VERCEL_ENV=production`.
- The stable phone-pilot alias is not automatically reassigned by preview builds.
- Build output is an allowlist of five public files (including the separate admin page). Tests, backend code, screenshots, local notes and credentials are excluded.
- No deployment token or database credentials are needed in these test jobs. They use fictitious local data, not customer accounts.

## Local checks

Install dependencies: `npm ci --prefix tests`.
Run core checks/build: `node scripts/build-pilot.mjs`.
Run browser checks: `node --test tests/ci-browser.test.mjs`.
On Linux, set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`.

## Isolated database for generated test builds

`atlas-test` is a separate Supabase project (`manikkusokwysmdfhxtu`).
`scripts/test-environment.mjs` configures generated `pilot-dist/index.html` only:
fixed test endpoint, public publishable key, separate local data/session/write-queue
namespaces and a visible TEST banner. Saved connection settings cannot override it.
The build fails if a known live-project reference remains. Source `index.html` and
the existing stable phone pilot are intentionally unchanged. Open the generated
preview, not the raw source HTML, when testing the new database.

The test database has its own users. Existing customer/pilot logins do not carry
over. Use fictitious records only. RLS (row-level security) allows authenticated
accounts to read/write only their own rows. SQL assertions checked own writes,
cross-account reads/updates/inserts and rollback cleanup. Anonymous REST reads
and writes are denied (401/42501); invalid credentials are rejected.

`admin.html` is a read-only test account overview. Its public page does not grant
access: `atlas_admin_accounts()` checks the signed-in identity against a server-only
allowlist and requires confirmed email. Ordinary users cannot read or change that
allowlist. The function returns account metadata and counts, never documents,
passwords or rental contents. Last sign-in is not live activity. Provision admin
access only in atlas-test, with explicit approval.

Important limits: separate test login and refresh/persistence still need a real
test account. Test push sending is deliberately disabled, and the cloud OCR
function has not been provisioned in this new project. Neither feature falls
back to the live database. The working phone pilot remains available separately.

Run generated-app browser checks after building:
`ATLAS_HTML="$PWD/pilot-dist/index.html" node --test tests/ci-browser.test.mjs`.

Core tests do not prove physical phone receipt. One closed-app, locked-iPhone test was confirmed by the user on 18 October 2026. Daily reminders, offline recovery and account switching still need real-device verification. Mac notification receipt remains unproven.

The browser job checks rendering and opening rental forms in three languages; it is not a full visual/accessibility, real OCR or real push-provider test.
