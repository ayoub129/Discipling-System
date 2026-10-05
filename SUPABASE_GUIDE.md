# Supabase operations

Project zgoxppthlktmikfihsiz has the October 5, 2026 customer-readiness upgrade, private avatar storage and authenticated account controls applied. The discipline-hourly-maintenance pg_cron job is active at 0 * * * *.

The upgrade preserved 12 quests, 30 redemptions and recorded progression balances. Evidence is in supabase/VERIFIED_LIVE_STATE.json. An authenticated quest completion/retry test passed inside a rolled-back transaction.

The private discipline_backup_20261005 schema snapshots original tables, functions and policies. Application roles have no access. This is not an offsite backup or point-in-time recovery. Coordinate any restore with the application/schema version and subsequent customer activity.

Do not rerun supabase/live-upgrade.sql or legacy imports on this project. npm run db:bundle only regenerates the SQL artifact.

## New projects

Apply the three files in supabase/migrations in numeric order, then review and apply account-storage.sql and scheduler.sql. For another legacy project, inspect its schema/data before using the upgrade. The legacy fixture covers this project's original structure, not arbitrary databases.

Client APIs use the anonymous key with the customer's verified session. Critical balance/status/redemption changes use authenticated transactional functions. Public tables have RLS. Avatars are private, limited to each user's folder, 2 MB and JPEG/PNG/WebP. Account deletion requires DELETE confirmation, a current session and password authentication within five minutes. It removes the caller's private snapshot entries too when the snapshot exists.

The normal app needs no service-role key. An optional HTTP cron alternative requires SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET; follow pagination until next is null. Prefer this project's installed database scheduler. Monitor cron failures and security advisories, and test production Auth/email before launch.
