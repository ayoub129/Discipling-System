# Supabase Database Access Guide

## Overview
Your Discipline System application is connected to Supabase PostgreSQL database. All authentication and data is stored securely in your Supabase project.

## Connection Details
Your Supabase integration is automatically configured with:
- **NEXT_PUBLIC_SUPABASE_URL** - Public API endpoint
- **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Client-side authentication key
- **SUPABASE_SERVICE_ROLE_KEY** - Server-side admin key (keep secret!)
- **POSTGRES_URL** - Direct database connection string

All environment variables are already set in your Vercel project settings.

## How to Access Your Database

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to [https://supabase.com](https://supabase.com)
2. Sign in with your account
3. Select your project from the list
4. Click **SQL Editor** on the left sidebar to write queries
5. Click **Table Editor** to view/edit tables visually

### Option 2: Via Vercel Project Settings
1. In your v0 project, click **Settings** (top right)
2. Go to **Integrations** tab
3. Click on **Supabase**
4. Click **Go to Supabase Dashboard** to access your database

### Option 3: From Your Code
The application connects to Supabase automatically using:
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data, error } = await supabase.from('your_table').select('*')
```

## Current Database Tables

### auth.users (Built-in Supabase table)
- Stores user authentication information
- Fields: id, email, encrypted_password, email_confirmed_at, created_at

### Creating New Tables
To create tables for quests, rewards, etc., use the SQL Editor in Supabase Dashboard:

```sql
-- Example: Create a quests table
CREATE TABLE public.quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own quests
CREATE POLICY "Users can view own quests" ON public.quests
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quests" ON public.quests
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quests" ON public.quests
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quests" ON public.quests
FOR DELETE USING (auth.uid() = user_id);
```

## Important Security Notes

1. **Row Level Security (RLS)** - Always enable RLS on production tables to ensure users can only access their own data
2. **Service Role Key** - Keep `SUPABASE_SERVICE_ROLE_KEY` secret. Only use it in server-side code
3. **Anon Key** - The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose in your client code

## API Documentation
- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)
- PostgreSQL Reference: [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)

## Troubleshooting

**Connection refused?**
- Ensure all environment variables are set in your Vercel project
- Check that Supabase project is running

**RLS policy errors?**
- Verify the user is authenticated with `supabase.auth.getUser()`
- Check RLS policies match your query operation (SELECT, INSERT, UPDATE, DELETE)

**Email confirmation not required?**
- Email confirmation is disabled in your signup flow for development
- Enable it in Supabase Auth Settings → Email Templates if needed
