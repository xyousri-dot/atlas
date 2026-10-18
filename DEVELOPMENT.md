# Atlas: test first, release separately

- Customer GitHub Pages site uses `main`. Do not push or merge there without explicit release approval.
- Development pushes use `atlas-pilot/**`; GitHub Actions runs core checks and browser smoke checks.
- Vercel project: **atlas-phone-pilot**, team **xyousri-9529s-projects** only.
- Git-connected deployments must be **Preview**. `main` deployments are disabled in vercel.json; the build also refuses `VERCEL_ENV=production`.
- The stable phone-pilot alias is not automatically reassigned by preview builds.
- Build output is an allowlist of four public files. Tests, backend code, screenshots, local notes and credentials are excluded.
- No deployment token or database credentials are needed in these test jobs. They use fictitious local data, not customer accounts.

## Local checks

Install dependencies: `npm ci --prefix tests`.
Run core checks/build: `node scripts/build-pilot.mjs`.
Run browser checks: `node --test tests/ci-browser.test.mjs`.
On Linux, set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`.

Preview is not full isolation: this app still points at the existing Supabase pilot database. Do not use real customer credentials or enter disposable test records there. A separate database and account-isolation tests are required before customer rollout.

Core tests do not prove physical phone receipt. One closed-app, locked-iPhone test was confirmed by the user on 18 October 2026. Daily reminders, offline recovery and account switching still need real-device verification. Mac notification receipt remains unproven.

The browser job checks rendering and opening rental forms in three languages; it is not a full visual/accessibility, real OCR or real push-provider test.
