# Discipline System - Setup Guide

## Issue: "Email not confirmed" Error

Supabase requires email confirmation by default. Since you don't have a domain for email confirmations, follow these steps:

### Step 1: Disable Email Confirmation in Supabase

1. Go to your Supabase dashboard: https://app.supabase.com
2. Navigate to **Authentication → Providers → Email**
3. Under "Confirm email", toggle OFF the email confirmation requirement
4. Click **Save**

This allows users to sign up and login immediately without confirming their email.

## Step 2: Create Database Tables

The database schema has been prepared in `scripts/001_create_tables.sql`. This creates 17 tables needed for the Discipline System:

### Tables Created:
- `profiles` - User profile data
- `user_settings` - User preferences
- `rank_definitions` - Custom rank system
- `user_stats` - User progression and stats
- `quests` - Tasks/quests system
- `rewards` - Reward definitions
- `penalties` - Penalty system
- `activity_logs` - Activity feed
- And 9 more supporting tables...

### To Run the Migration:

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to https://app.supabase.com → Your Project
2. Click **SQL Editor** in the left sidebar
3. Click **+ New Query**
4. Copy and paste the entire contents of `/scripts/001_create_tables.sql`
5. Click **Run** (or Cmd/Ctrl + Enter)
6. Wait for all tables to be created

**Option B: Via Supabase CLI**
```bash
supabase db push
```

## Step 3: Test Authentication

Once email confirmation is disabled:

1. Go to your app and click **Sign up**
2. Enter email and password
3. You should be redirected to the dashboard immediately
4. To login again, click **Sign in** and use your credentials

## Troubleshooting

### Still getting "Email not confirmed"?
- Make sure you toggled OFF email confirmation in Authentication settings
- Try signing up with a new email address
- Clear your browser cache and cookies
- Check Supabase logs for any errors

### Database migration failed?
- Make sure you're in the correct project in Supabase
- Check for any SQL syntax errors
- Ensure Row Level Security (RLS) is enabled on the tables
- All RLS policies are already included in the migration

### Can't see tables in database?
- Refresh the Supabase dashboard
- Navigate to **Database** → **Tables**
- Scroll down to see all 17 tables with RLS policies

## Database Schema Overview

The system is designed with Row Level Security (RLS) to ensure:
- Users can only see their own data
- Users can only modify their own records
- Rewards can be global or personal
- All activity is tracked and secured

### Key Relations:
- `profiles.id` ← Foreign Key Reference in all user data tables
- `rank_definitions` ← Referenced by user_stats for ranking
- `quests` ← Core task management with penalty tracking
- `rewards` ← Redemption system with point costs
- `penalties` ← Discipline system with severity levels

## Next Steps

After completing setup:
1. Test user signup/login flow
2. Create a profile through the Settings page
3. Start creating quests and managing your discipline system
4. Unlock rewards by completing tasks and earning points

For API integration with the database, refer to `/lib/supabase/client.ts` and `/lib/supabase/server.ts`
