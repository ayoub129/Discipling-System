# Setup and release

Use Node.js 22 or newer and npm. Copy `.env.example` to `.env.local` and configure the public Supabase URL and anonymous key. Never expose a service-role key with NEXT_PUBLIC_. Run npm ci, then npm run dev.

Before deployment run npm run typecheck, npm run lint, npm test and npm run build. Deploy this updated application with its database upgrade; older APIs cannot directly update balances or quest status.

Project zgoxppthlktmikfihsiz was upgraded and verified on October 5, 2026. Do not rerun live-upgrade.sql on this project. See SUPABASE_GUIDE.md.

## Customer launch requirements

1. Deploy this source and set production environment variables.
2. Configure Supabase Auth Site URL and allowed callback URLs for the production domain. Test signup confirmation and password reset using a real inbox. Keep email confirmation enabled for customers; configure production SMTP and review Auth rate limits.
3. Test signup, signin, quest completion, redemption, avatar upload, export and deletion with disposable staging accounts. Test two users for isolation. Do not delete the existing owner account as a test.
4. Add your support email, privacy policy and terms appropriate to the product. Review data retention, including private migration backups.
5. Configure error monitoring, alerts and an independently restorable database backup. Verify hourly cron executions succeed, beyond checking that the job is scheduled.

Reminders work while the application is open. Background push notifications are not implemented. Rewards are personal habit incentives. Billing is not implemented.
