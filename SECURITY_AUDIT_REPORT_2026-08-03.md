# Somnara Application Security Audit

Date: 3 August 2026  
Scope: current `main` checkout at commit `805d3e4`, including Expo 56 client code, dependency graph, local persistence, Supabase client integration, and canonical SQL schema.  
Method: source review, trust-boundary analysis, secret/history scan, npm advisory audit, Expo compatibility checks, TypeScript validation, and Expo web export. No production Supabase project, native release binary, physical device, BLE protocol, or authenticated live environment was available.

## Executive verdict

The client update introduced critical authentication and device-ownership bypasses. Any email/password and any sufficiently long device code could previously produce authenticated and paired UI state without backend proof. These paths have been removed locally and now fail closed. The source is materially safer, but it is not production-ready until the hardened database schema is migrated, inventory is securely provisioned, and the native/live controls below are verified.

## High-risk remediation completed locally

- Replaced simulated email authentication with Supabase `signInWithPassword` and `signUp`; application users now come only from Supabase-authenticated identities.
- Exchanged Apple identity tokens with Supabase and added nonce/state replay protection. Google login is deliberately disabled until a verified Supabase OAuth callback is configured.
- Added session restoration/sign-out and encrypted native session persistence using Expo SecureStore, with chunking for platform payload limits. Web sessions use the platform storage fallback and remain subject to normal browser/XSS risk.
- Namespaced and validated AsyncStorage data by authenticated user ID, preventing one account from inheriting another account's local alarms/preferences on a shared device.
- Replaced arbitrary client-side pairing with a rate-limited `claim_device` database function backed by private, hashed activation-code inventory. Activation codes are masked in the UI.
- Replaced simulated factory reset with an authenticated `unlink_device` function. Unlinked inventory enters `reset_required`, so a previously known code cannot immediately reclaim the device.
- Disabled simulated ownership transfer success; it now reports that the secure invitation workflow is not configured and makes no state change.
- Hardened RLS into role-specific SELECT/INSERT/UPDATE/DELETE policies with explicit `WITH CHECK`, column-level update grants, private tables, constrained fields, per-user alarm keys, and fixed `search_path` on security-definer functions.
- Added UUID alarm IDs and removed raw PostgREST `not in (...)` filter construction.
- Updated Expo within SDK 56, restored required native peer dependencies, added SecureStore and BuildProperties, disabled Android cleartext traffic, enabled Android release minification/resource shrinking, disabled native network inspection, and enabled iOS privacy-manifest aggregation.
- Secret scan found no credentials in tracked history. The only match was a package-lock integrity hash.

## Remaining release blockers

### P0 - deploy and prove the database controls

The revised `supabase/schema.sql` is a canonical fresh-environment schema, not proof that an existing Supabase project is migrated. Create and review a migration for the live database, back up first, provision `private.device_inventory` from trusted manufacturing/admin tooling, and verify RLS with two real users plus anon requests. Never expose a service-role key or plaintext activation codes in the app, repository, SQL history, logs, or `EXPO_PUBLIC_*` values.

### P0 - secure the real hardware boundary

The app still simulates BLE connection, power, and device control. Before claiming real device security, implement cryptographic device identity, proof-of-possession pairing, authenticated/encrypted commands, anti-replay counters, signed firmware/update verification, safe reset/transfer semantics, and lost-device revocation. Test against a physical device and hostile nearby Bluetooth clients.

### P1 - authentication production configuration

- Configure stable iOS bundle ID and Android package ID, EAS project ownership, Supabase redirect allowlists, Apple provider credentials, and the native Apple capability.
- Enable and test email confirmation, CAPTCHA/bot protection, server-side password policy, leaked-password protection, rate limits, recovery flows, and appropriate MFA in Supabase.
- Implement Google through a verified Supabase OAuth/ID-token flow before re-enabling its button.
- Test sign-up, confirmation, sign-in, refresh, revocation, sign-out, offline/reconnect, reinstall, and account switching on physical iOS and Android devices.

### P1 - complete ownership lifecycle

Build a server-controlled, expiring, single-use transfer invitation with reauthentication, recipient acceptance, audit trail, cancellation, notification, and physical-device reset/rotation. Do not implement ownership changes as a direct client update by email.

### P1 - live authorization and abuse tests

Add automated tests proving anon denial, cross-user denial, immutable device owner/serial fields, activation attempt limits, activation-code replay denial, unlink behavior, malformed payload rejection, and concurrency safety. Add Supabase audit/alert monitoring for repeated authentication and activation failures.

### P2 - resilience and privacy

- Surface sync failures instead of silently ignoring them, add bounded retries/conflict resolution, and test malformed/tampered local data.
- Confirm the privacy notice and Terms/Privacy links; document diagnostics included in support emails and minimize data to what support needs.
- Add dependency scanning and secret scanning in CI with an Expo-SDK compatibility gate.

## Dependency status

After SDK-aligned remediation: 0 critical, 0 high, 27 moderate affected dependency nodes in `npm audit --omit=dev --json`. These cascade from one `uuid` advisory through Expo's `xcode` build-tool dependency; npm reports no safe fix for the relevant Expo 56 path. Do not use `npm audit fix --force`, because a forced resolution can break or downgrade the Expo SDK. Track the Expo 56 patch line and retest when its toolchain updates.

## Verification performed

- `npx tsc --noEmit` - passed.
- `npx expo-doctor` - 21/21 checks passed.
- `npx expo install --check` - dependencies up to date.
- `npx expo export --platform web` - passed; temporary export written outside the repository.
- `git diff --check` - passed.
- Tracked-history credential-pattern scan - no credential found.

## Status boundary

The fixes are local source changes only. They have not been committed, pushed, deployed, applied to a Supabase project, tested against real accounts or inventory, built as signed native release binaries, or verified with physical Somnara hardware.
