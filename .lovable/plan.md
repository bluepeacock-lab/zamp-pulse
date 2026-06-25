# Multi-Client (Tenancy) for ZampPulse

Today every row in `agents`, `task_events`, `correction_events`, `baselines`, and `health_signals` is implicitly owned by one customer. We will introduce a top-level **Client** entity so the same product can serve DoorDash, Uber, etc., and demo the multi-tenant story to the founder.

## Demo narrative

- Header shows the active client: `🟢 ZampPulse · DoorDash ▾`
- Clicking the name opens a switcher with **DoorDash** and **Uber**
- Selecting a client instantly re-scopes Dashboard / Agent / Tasks / Health pages
- `demo@zamp.ai` is associated with **both** clients (so one login can demo both); default = DoorDash

## Database changes (one migration)

1. New table `clients`
   - `id uuid pk`, `slug text unique`, `name text`, `created_at`
   - Seed: `doordash` → "DoorDash", `uber` → "Uber"
2. New join table `user_clients`
   - `user_id uuid → auth.users`, `client_id uuid → clients`, `is_default bool`
   - Seed: link the demo user to both, default = DoorDash
3. Add `client_id uuid references clients(id)` to: `agents`, `task_events`, `correction_events`, `baselines`, `health_signals`
4. **Backfill**: set every existing row's `client_id` to DoorDash, then `NOT NULL` + index
5. For Uber, clone a subset of agents + ~120 task_events with slightly different numbers so the switcher visibly changes the dashboard (not just an empty state)
6. RLS / GRANTs: keep current anon-read posture for now; add `client_id` to indexes used by the dashboard queries

## App changes

### Client context
- New `src/lib/client-context.tsx` — React context exposing `{ activeClient, clients, setActiveClient }`
- Loads on mount: fetch `clients` the user has access to via `user_clients`
- Persists selection in `localStorage` (`zp.activeClientId`)
- Wraps the app inside `__root.tsx` (above existing layout)

### Header switcher (`src/components/Layout.tsx`)
- Replace the static `🟢 Zamp Observatory` with `🟢 ZampPulse · {ClientName} ▾`
- Dropdown lists the user's clients with a check on the active one
- Compact on mobile (just client name + caret)

### Data fetching
- Every Supabase query in `dashboard.tsx`, `agent.$agentId.tsx`, `tasks.tsx`, `health.tsx` gets `.eq('client_id', activeClient.id)`
- Re-run queries when `activeClient` changes (effect dep)
- Agent detail page also validates that the agent belongs to the active client (404 otherwise)

### Login
- After successful sign-in, hydrate clients list and default selection before redirecting to `/dashboard`

## Out of scope (for this pass)
- No per-user admin UI to manage clients (seeded via SQL)
- No client-scoped theming/logos (header text only, per your choice)
- No write-side RLS hardening — still relying on anon policies that exist today; can tighten later

## File touch list
- `supabase_setup.sql` (or a new `supabase_multitenant.sql`) — schema + seed + backfill
- `src/lib/client-context.tsx` *(new)*
- `src/routes/__root.tsx` — wrap with provider
- `src/components/Layout.tsx` — header switcher
- `src/routes/dashboard.tsx`, `src/routes/agent.$agentId.tsx`, `src/routes/tasks.tsx`, `src/routes/health.tsx` — add `client_id` filter + reactivity
- `src/routes/login.tsx` — ensure context hydrates post-login
- `README.md` / `src/routes/docs.tsx` — short note about multi-tenancy

## Deliverable for you
You'll get a single SQL block to paste into Supabase (schema + Uber seed + backfill) and the code wired up. After running the SQL, the header will show `DoorDash ▾` and switching to Uber will reload the dashboard with Uber's agents and metrics.
