# Development Blueprint

## 1. Planned Technology

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | React + TypeScript | Responsive user interface and client-side application logic |
| Backend platform | Supabase | Authentication, database API, storage, edge functions where needed |
| Database | PostgreSQL | Relational business, transactional, and operational data |

## 2. Folder Responsibilities

| Folder | Responsibility |
| --- | --- |
| `frontend/` | React application, UI components, pages, hooks, and client services |
| `backend/` | Supabase configuration, edge functions, and backend integration notes |
| `database/` | Migrations, schema definitions, seed data, and database documentation |
| `assets/` | Logos, illustrations, icons, and other static project assets |
| `scripts/` | Repeatable local-development, validation, and maintenance scripts |
| `docs/` | Product and technical blueprints |

## 3. Frontend Direction

- Use TypeScript in strict mode.
- Organize code by feature as the application grows.
- Create reusable UI components for shared interactions.
- Keep Supabase access behind service or repository modules.
- Validate forms before persistence and show actionable errors.

## 4. Supabase Direction

- Use Supabase Auth for identity in a later sprint.
- Store application data in PostgreSQL tables with explicit business and branch scoping.
- Apply row-level security before exposing production data.
- Use migrations as the source of truth for schema changes.
- Add edge functions only for secure server-side workflows that cannot run safely in the client.

## 5. Development Sequence

1. Initialize React + TypeScript and Supabase configuration.
2. Implement database migrations, constraints, and seed data.
3. Build catalog and inventory foundation.
4. Build sales, purchase, and finance workflows.
5. Add dashboard, reporting, testing, and release readiness.

## 6. Quality Baseline

- Keep documentation current with every material data-model change.
- Review database migrations before applying them to shared environments.
- Test critical transaction flows, especially sales and inventory updates.
- Never expose service-role credentials to the frontend.

## 7. Sprint 1 Boundary

This sprint creates only the foundation and documentation. It intentionally does not initialize the frontend, configure Supabase, create SQL migrations, implement authentication, or add production application code.

## 8. Sprint 3 Application Foundation

Sprint 3 initializes the frontend as a Vite application using React and TypeScript. It establishes the first application layers:

```text
frontend/
├── src/
│   ├── components/   # Reusable presentational components
│   ├── hooks/        # Reusable client state and integration hooks
│   ├── layouts/      # Page shells, including the dashboard layout
│   ├── pages/        # Route-level screens
│   ├── routes/       # Client routing definitions
│   ├── services/     # Supabase client and feature service boundaries
│   ├── styles/       # Global visual styles
│   └── utils/        # Stateless helpers and formatters
├── .env.example      # Required public Supabase environment variables
├── package.json
└── vite.config.ts
```

### Implemented foundation

- Login page with BusinessOS branding, email, password, and login action.
- First dashboard layout with a sidebar, header, and routed main-content area.
- Supabase client and authentication service boundary, configured only through public environment variables.
- An environment-safe login state: until Supabase is configured, the form clearly reports that setup is required.
- A backend integration guide in `backend/supabase/README.md`.

### Sprint 3 boundary

The visual foundation and integration boundary are implemented, but no Supabase project, user account, database migration, row-level security policy, or live business data has been created. Authentication becomes live after valid Supabase credentials and Auth configuration are supplied.

## 9. Sprint 4 Authentication and Core Database

Sprint 4 connects the application to Supabase Auth and establishes the first organization schema. The application is no longer allowed to use a dashboard without a valid Supabase session.

### Authentication flow

```text
Sign up → (confirm email when required) → Sign in → Workspace gate
  → no active business membership: first-time setup
  → active business membership: dashboard
```

- `AuthProvider` initializes state from `getSession` and keeps it current with `onAuthStateChange`.
- Login uses `signInWithPassword`; registration uses `signUp`; the header and first-time setup include `signOut`.
- Public-only routes redirect signed-in users to the workspace gate.
- Protected routes redirect signed-out users to Login.
- The first-time setup calls one protected Supabase RPC to create a business, owner membership, first branch, and branch assignment atomically.

### Core migration and security

`database/migrations/20260717_001_auth_and_core_database.sql` defines `profiles`, `businesses`, `business_members`, `branches`, and `branch_members`, plus timestamp triggers, the Auth-user profile trigger, integrity checks, RLS helper functions, RLS policies, and `create_business_with_owner`.

The migration is intentionally not applied automatically. It must be reviewed and run in the target Supabase project before the onboarding screen can create data. The frontend uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; privileged keys never belong in the frontend.

### Architecture review additions

- Business types are standardized as `food`, `fashion`, `retail`, `service`, `manufacturing`, `warehouse`, and `other`.
- Every core table includes creator/updater audit references and soft-delete metadata.
- Profiles include locale, preferred language, last-login, and last-seen timestamps.
- Businesses include owner and contact details; branches support latitude and longitude.
- Active-record unique indexes and RLS filters exclude soft-deleted rows while preserving the original membership and branch-access rules.
