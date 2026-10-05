# Discipline System: customer readiness audit

This is the original pre-fix audit. Implementation and live database verification are now recorded in [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md); remaining release steps are in [SETUP_GUIDE.md](SETUP_GUIDE.md). Findings below describe the earlier code, not the current implementation.

Reviewed: 2026-10-05. Scope: all application pages, API handlers, authentication/session helpers, domain components, configuration, package scripts, and setup documentation in this checkout. Shared UI primitives were inventoried; they were not individually exercised in a browser.

## Verdict

This is a substantial prototype of a personal, gamified productivity application. It is not ready for a public customer launch. The immediate priority is reliable domain logic and customer account flows, followed by completing visible features and proving isolation between users.

The intended loop is: plan quests -> start and complete them -> earn XP and reward points -> level up and advance ranks -> redeem personal rewards. Late or missed quests add penalty points; users create and complete corrective penalties. Calendar, dashboard, progress, and settings support that loop.

Implemented surfaces include signup/login/logout, quest creation/edit/delete/duplication, optional task times, recurrence flags, categories, a monthly calendar, dashboard actions, XP and level calculations, custom ranks and progression rules, reward creation/redemption, penalty creation/activation/completion, profile/avatar updates, themes, and charts. Presence of source code is not proof that these work against the deployed database.

## P0: fix before inviting customers

1. **Repeated completion awards XP and points repeatedly.** `app/api/quests/route.ts:436` runs completion effects whenever the request says completed, without requiring a transition from an eligible previous status. The same request can also add delay penalties, generate another recurring quest, and shift schedules repeatedly. Add an explicit transition policy and an atomic, exactly-once completion operation. Repeated requests must return the existing outcome. Starting an already started quest currently overwrites actual_start; prevent that too.

2. **Multi-step mutations can corrupt balances or partially succeed.** Quest status is committed before stats, histories, recurrence, and schedule effects. Many subsequent Supabase errors are ignored, and the API can return success despite failure. Redemption inserts history before deducting points (`app/api/rewards/redeem/route.ts`); two simultaneous requests can both redeem against the same balance and overwrite the deduction. Penalty operations have the same read-modify-write problem. Implement database transactions with locking or conditional atomic updates and uniqueness constraints. Cover completion racing with completion/redemption/penalty operations and retries after network failures.

3. **Reward eligibility is only partly enforced by the server.** The redemption API checks cost, cooldown, weekly count, and points, but not minimum level, rank, discipline, active status, or explicit personal/global eligibility. UI restrictions can be bypassed by direct requests. Enforce all requirements inside the atomic redemption operation. Actual cross-user exposure depends on database RLS, which was unavailable for review.

4. **Session routing relies on a cookie's presence.** `middleware.ts` checks only the unsuffixed cookie name; chunked cookies can be missed, stale cookies can redirect customers away from login, and cookie presence does not validate a session. `lib/supabase/proxy.ts` deliberately skips session refresh. Server components can swallow cookie update failures without a working refresh layer. Replace this with verified auth/session refresh and consistent server protection, including activity. API handlers generally do call getUser; cookie presence alone does not establish an API data-access bypass.

5. **The database cannot be reproduced or its isolation audited.** `SETUP_GUIDE.md` references `scripts/001_create_tables.sql`, which is absent. No SQL migrations, policies, triggers, or seeds were found. Commit the actual schema, foreign keys, indexes, checks, RLS policies, profile/stat initialization, and starter data. Prove user A cannot read, alter, or reference user B's data, including rank/category/penalty/reward references and histories.

6. **Public signup and account recovery are incomplete.** Signup attempts manual login when confirmation returns no session, so enabling email verification leads to an error instead of a check-your-email flow. There is no callback, resend verification, forgot password, or reset password route. Add these and test expired links, existing accounts, wrong passwords, and return visits. Confirm new users receive profiles, settings, stats, and usable starter ranks without manual SQL.

7. **API input validation is insufficient.** TypeScript casts do not validate request bodies. Reject unsupported statuses/actions, invalid dates and time ranges, negative/nonfinite/out-of-range amounts, wrong types, excessive text, and foreign references before writing. Large XP values can create excessive level-up loops and database writes. Malformed requests should produce useful 400 responses. Avatar upload lacks server-side file type and size checks; validate images and clean up replaced or failed uploads.

## P1: repair the core product loop

8. **Rewards can be impossible to redeem.** `app/rewards/page.tsx:144` returns false when no minimum rank is supplied, even though no rank requirement should pass. The default weekly maximum is 0, and the API rejects when count >= 0, blocking every redemption. Define null as unlimited and make UI defaults match. Discipline defaults to a 20% requirement, but no application code updates discipline_score; inspect any external triggers, then implement and explain the score or remove the requirement until it works.

9. **Penalty relations are interpreted inconsistently.** The penalties page reads penalty_definitions as an object, while the API PATCH and dashboard read it as an array with [0]. Verify the actual foreign-key relation and normalize a single representation. With an object response the API uses zero trigger points/XP loss, bypassing activation thresholds and preventing expected deductions.

10. **Penalty state and deadlines need a defined lifecycle.** Complete does not require in-progress and does not reject already completed/expired instances; repeated calls can repeatedly deduct points/XP. Deadlines start at definition creation, even before activation. Expiry and XP loss are only applied when complete is called; an ignored overdue penalty does not expire through any worker in this checkout. Separate reusable definitions from instances, issue instances at the intended trigger, set due time at the appropriate transition, and expire them exactly once. Define whether XP loss can lower levels/ranks and apply that consistently.

11. **Day rollover misses unfinished quests.** Rollover runs only when another quest is completed and looks only at yesterday. It adds missed-task penalty points only when current_minus_points changes; the usual zero-minus unfinished task contributes nothing. Multi-day absences are missed. Replace this with an idempotent catch-up operation and scheduled execution covering all overdue dates, with a record of each applied event.

12. **Recurrence is completion-dependent and date-fragile.** The next occurrence is created only after completion, so skipped/cancelled tasks stop the series. No series identifier or uniqueness guard exists in the handler. Month/year mutation rolls dates such as January 31 into a later month. Reusing the UTC time component does not preserve local clock time across offset changes and can shift midnight-adjacent tasks onto the wrong local day. Add series rules, timezone-aware occurrence generation, duplicate protection, month-end policy, skip/pause/end, and this-occurrence versus whole-series editing.

13. **Schedule settings do not control scheduling.** allow_auto_shift, allow_fixed_quests_shift, and day boundaries are stored but never read by the quest mutation code. Completion can shift a fixed quest despite the default setting disabling that. Only one exactly adjacent fixed quest is shifted, with no conflict or midnight handling. Define fixed versus flexible semantics, respect settings, handle overlaps, and show the user the resulting schedule.

14. **Editing changes the configured delay cap accidentally.** `app/quests/page.tsx:483` initializes minusPoints from current_minus_points rather than max_minus_points. Saving an unrelated edit can replace the configured cap with accrued points or zero (which the API interprets as unlimited). Load the configured cap and keep accrued penalty state separate. Completion also overwrites penalties_points with zero, mixing a rule with its applied result; preserve configured failure penalties independently.

15. **Streaks can be stale or retroactively incorrect.** Evaluation runs on quest completion only. Inactivity does not reset displayed current streak; adding/deleting/cancelling tasks does not re-evaluate the day. Completing an older date can overwrite today's displayed streak. Define day closure, treatment of cancelled tasks and empty days, and historical edits; derive current streak from finalized day outcomes.

16. **History and totals can disagree.** Completed quests remain editable/deletable without reversing or preserving earned events. Charts aggregate mutable quest values and planned dates rather than immutable earnings/completion events. Daily buckets omit 00:00-08:59 and untimed quests. API charts/rollover use UTC while the dashboard/calendar use local dates. Store an IANA timezone and immutable XP/point/penalty events, and use them consistently for charts, balances, and histories.

## P1: finish visible customer features

17. **Activity is sample data.** `app/activity/page.tsx` and `components/activity-log.tsx` render hardcoded examples. Add persistent activity events with real timestamps, filtering, pagination, and an honest empty state. The root dashboard also invokes components with demonstration defaults; consolidate the root route with the real dashboard.

18. **Redemption history vanishes from the UI on refresh.** The database stores redemptions, but the rewards page only adds newly redeemed items to component state and never fetches prior redemptions. Add a user-scoped history endpoint and load it. Keep UUID reward IDs as strings instead of Number(reward.id).

19. **Progress displays do not refresh after actions.** Dashboard quest completion changes the task locally without updating XP, balance, rank, streak, or shifted tasks. Shared UserProvider has no auth-change subscription, uses an account-independent localStorage key, and never removes that cache on logout/401. This can briefly display a previous customer's profile on a shared browser. Clear/scope cache by auth user and refresh all affected data after successful mutations or account changes.

20. **Management is incomplete.** Rewards and penalties lack edit/archive/delete flows; categories lack edit/delete/reorder; progression rules have create but no edit/delete endpoint. Add management with clear rules for referenced/historical records. Archived definitions should preserve history.

21. **Notification preference has no delivery system.** Implement reminders/notifications with permission, scheduling, timezone, and opt-out behavior, or remove the promise from the first release. No reminder worker or delivery implementation was found.

22. **Failure handling needs user feedback.** Several loads silently keep zero/empty data when APIs fail, and optimistic actions revert without explaining the error. Use distinct loading/empty/error states, retry actions, pending button states, and useful success/error feedback. Apply saved themes on app entry, not only after visiting settings. Allow browser zoom; current layout metadata requests userScalable false.

## Launch support and optional expansion

For a customer release, add account export/deletion, support contact, onboarding explaining XP/ranks/rewards/penalties, and clear descriptions of how personal reward redemption works. Review public-facing privacy/terms content appropriate to the service. Add error monitoring with personal-data-safe logs, backups with a tested restore, request/upload limits, and a production configuration checklist.

For a paid product, add pricing, payment checkout, verified webhook handling, subscription access, billing management, cancellation, and failed-payment behavior. Billing is conditional on the business model and is not required for a free beta. Teams, social features, AI coaching, native apps, and a marketplace are optional expansions, not launch prerequisites.

## Verification status

- No code fixes or production/database mutations were made during this audit.
- No test suite, CI workflow, SQL schema, or environment example was found in this checkout.
- `npm.cmd run lint` failed: eslint executable unavailable. eslint is also missing from package.json and no lint configuration was found.
- `npm.cmd run build` failed: next executable unavailable because dependencies are not installed. This is not evidence that the source compiles or fails compilation after installation.
- `next.config.mjs` sets ignoreBuildErrors true. Remove that bypass and require a clean TypeScript check and production build.
- Both npm and pnpm lockfiles exist. Choose the intended package manager and use a reproducible clean install.
- No local Supabase/Blob environment configuration or connected deployed database was available. Live authentication, RLS, triggers, email delivery, storage configuration, browser/mobile behavior, and runtime database joins remain unverified.

## Recommended implementation order

1. Recover/commit database schema and policies; establish a clean install, typecheck, lint, build, and staging configuration.
2. Implement atomic quest/points/redemption/penalty operations, valid transitions, input validation, and database isolation tests.
3. Complete signup verification, session refresh, password recovery, and new-account initialization.
4. Repair reward unlocking, penalty relations/lifecycle, rollover, recurrence, timezone, streaks, and schedule preferences.
5. Replace sample activity; load redemption history; synchronize UI after mutations; finish definition management and errors.
6. Add onboarding/account controls/support and production monitoring/backups; test the customer journey in staging and launch a small beta.

## Release acceptance checklist

- A new customer signs up, verifies email, signs in, receives usable defaults, logs out, recovers a password, and returns without manual intervention.
- A completed quest grants its earnings exactly once, including retries and two simultaneous requests; all stats and histories agree after reload.
- Simultaneous redemptions cannot overspend; locked/inactive/foreign rewards cannot be redeemed by direct API calls; cooldowns and limits hold.
- Penalties activate, expire, and complete according to explicit rules, with each deduction applied once and ignored deadlines handled automatically.
- Recurring tasks survive missed days, month ends, midnight, and timezone offset changes; schedules honor all saved preferences.
- Inactivity and historical task edits produce correct streaks; chart totals reconcile with immutable earning events, including untimed and early-morning tasks.
- Two-account tests prove isolation across every table and reference; logout/account switching clears cached personal data.
- Real activity and redemption history survive refresh; actions update every affected view; errors offer recovery.
- Clean install, lint, typecheck, production build, meaningful domain tests, and browser smoke checks pass; mobile layout/keyboard/zoom are verified.
- Production connection settings, email links, uploads, request limits, monitoring, and backup restore are verified in staging.
