# Authentication troubleshooting

Check the public Supabase URL/key belong to the same project. Restart the local server after environment changes.

Signup may require email confirmation. The success page supports resend. Configure Supabase Auth Site URL and allowed redirects for the production domain and /auth/callback; test confirmation and password reset in a real inbox.

The Next.js proxy validates session claims and refreshes cookies. API handlers independently verify the user. Do not disable verification or use cookie-presence shortcuts to hide failures.

Keep passwords, session tokens and admin keys out of logs and issue reports. Provide the route, visible error, browser and whether a failure happened before or after confirmation.
