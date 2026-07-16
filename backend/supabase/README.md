# Supabase Integration Structure

This folder reserves backend assets for BusinessOS's Supabase integration. No Supabase project, migration, function, or credential is created in Sprint 3.

## Planned structure

```text
backend/supabase/
├── migrations/       # PostgreSQL migrations (Sprint 4+)
├── functions/        # Edge Functions when a server-side workflow is needed
├── seed/             # Development seed data
└── README.md
```

## Frontend connection

The frontend reads only these public, Vite-prefixed variables from `frontend/.env.local`:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Never place `SUPABASE_SERVICE_ROLE_KEY` or any privileged secret in the frontend. The initial client is isolated in `frontend/src/services/supabase.ts`, and authentication calls are isolated in `frontend/src/services/auth.ts`.

## Next backend steps

1. Create the Supabase project.
2. Convert the Database Blueprint into reviewed PostgreSQL migrations.
3. Configure Supabase Auth and row-level security using `business_members` and `branch_members`.
4. Add seed data and server-side functions only where client-side access is inappropriate.
