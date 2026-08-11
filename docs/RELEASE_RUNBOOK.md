# Somnara release runbook

The controlled process for shipping a change that touches auth, the database
schema, or sync — the areas where a mistake becomes a real incident, not just
a bug. For a routine UI-only change, CI passing is enough; use the full
checklist below whenever `supabase/schema.sql`, anything under
`src/lib/supabase.ts`/`src/context/SyncContext.tsx`/auth screens, or RLS
policies are involved.

## Prerequisites (one-time setup, not done from this repo)

These need a human with dashboard/GitHub-admin access — none of them can be
configured by committing code:

- A **staging** Supabase project, separate from production, with two
  disposable, email-confirmed test accounts for `scripts/verify-deployment.mjs`.
- Repo secrets: `SUPABASE_URL` (backend-health check), `STAGING_DATABASE_URL`
  (restore drill), `STAGING_SUPABASE_URL`/`STAGING_SUPABASE_ANON_KEY` +
  `TEST_USER_A_EMAIL`/`PASSWORD`/`TEST_USER_B_EMAIL`/`PASSWORD` (post-deploy
  verification), `EXPO_TOKEN` (release builds).
- A GitHub Environment named `production` (Settings → Environments) with a
  required-reviewer protection rule — this **is** the go/no-go gate on
  `.github/workflows/release.yml`; the workflow file only references it,
  it can't create the rule itself.
- Supabase's own Point-in-Time Recovery enabled on the production project
  (Database → Backups) — the real backup safety net. `scripts/backup-db.sh`
  is supplementary, for on-demand snapshots and the rehearsal drill, not a
  replacement for it.

## Migration review checklist

Anything touching `supabase/schema.sql` is required-review via
`.github/CODEOWNERS`. Before approving:

- [ ] Every new table has `enable row level security` **and** policies in
      the same change — never merged separately.
- [ ] New `security definer` functions pin `set search_path = ''` (or an
      explicit safe path) — an unpinned search_path is a privilege-escalation
      vector, and every existing function in this schema does this.
- [ ] Grants/revokes follow the existing least-privilege pattern: `revoke
      all ... from anon`, explicit `grant` of only the columns/commands a
      role actually needs (see the `paired_devices` column-level grants for
      the pattern).
- [ ] Column changes are backward-compatible with whatever app version is
      currently deployed (a column the live app doesn't know about yet is
      fine; removing/renaming one it depends on is not).
- [ ] If the change is meaningful, add/update a case in
      `supabase/tests/database/rls.test.sql`.

## Pre-release checklist (go/no-go)

Checked by whoever approves the `production` Environment gate:

- [ ] CI green on the release commit: typecheck, unit tests, `expo-doctor`,
      dependency audit, secret scan (`.github/workflows/ci.yml`).
- [ ] Any `supabase/schema.sql` change in this release has gone through
      migration review above and been applied to the **staging** project
      first.
- [ ] `supabase test db` run locally against staging (pgTAP RLS tests) —
      green.
- [ ] `scripts/backup-db.sh` run against production within the last
      24 hours (or PITR confirmed enabled and healthy).
- [ ] `.github/workflows/post-deploy-verify.yml` run against **staging**
      with this release's build — green.

## Release

1. Tag the release (`git tag vX.Y.Z && git push --tags`) or manually
   dispatch `.github/workflows/release.yml` — this is the point the
   `production` Environment's required-reviewer gate applies.
2. Once approved and the EAS build completes, roll out via the appropriate
   EAS Update channel for the profile used (`development`/`preview`/`production`,
   matching `eas.json`).

## Post-deployment

1. Run `.github/workflows/post-deploy-verify.yml` manually — **against
   staging**, immediately, to confirm the release didn't regress RLS
   enforcement (anon/cross-user access still denied, owner access still
   works). This is `scripts/verify-deployment.mjs`; see its header comment
   for exactly what it checks and why it never touches production data.
2. Watch `.github/workflows/backend-health.yml`'s next scheduled run (every
   15 min) and Sentry (once `EXPO_PUBLIC_SENTRY_DSN` is configured) for
   anything unexpected in the minutes after rollout.

## Rollback

**App:** roll the EAS Update channel back to the previous published update
(`eas channel:rollback`, or republish the prior update to the channel) —
this is near-instant and doesn't require a new build for a JS-only change.
For a native-code change, a new build with the previous version is required.

**Database:** `CONFIRM=1 DATABASE_URL=<production> ./scripts/restore-db.sh
<path-to-latest-good-backup>`, or restore from Supabase's PITR via the
dashboard (preferred — point-in-time, not just latest-snapshot). Never run
`restore-db.sh` against production without `CONFIRM=1` removed first (the
prompt is there on purpose) and a fresh backup of the *current* (bad) state
taken first, in case the rollback itself needs undoing.

## Rehearsal cadence

Run `.github/workflows/db-restore-drill.yml` against staging on a regular
cadence (monthly is reasonable) independent of any actual release — the
point is confirming the backup/restore scripts still work before the day
you actually need them under pressure.
