# ZampPulse

AI agent observability dashboard for [Zamp](https://zamp.ai). ZampPulse monitors autonomous task completion, escalation patterns, correction trends, and account health signals to surface performance drift and churn risk before it impacts customers.

## What it does

- **Executive Dashboard** — ATCR (Autonomous Task Completion Rate) hero metric, trend charts, and agent-level sparklines.
- **Agent Detail** — Per-agent ROI, baseline management, performance by task subtype, and 4 trend charts.
- **Task Log** — Filterable, sortable, paginated task history with expandable correction details and CSV export.
- **Account Health** — Real-time health scoring from live `task_events` data (volume decline, correction spikes, escalations, missing baselines).
- **Developer Docs** — In-app documentation page covering architecture, data flow, schema, and integration guide.
- **Supabase Auth** — Email/password login with a protected route wrapper.

## Tech stack

- **Framework**: [TanStack Start](https://tanstack.com/start/) (React 19 + Vite)
- **Styling**: Tailwind CSS v4
- **Data & Auth**: Supabase (PostgreSQL + Auth)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Package manager**: Bun

## Project structure

```text
src/
  components/
    Layout.tsx              # App shell, header, auth gate
  integrations/
    supabase/
      client.ts             # Supabase browser client
  routes/
    __root.tsx              # Root layout + head metadata
    index.tsx               # Redirects / → /dashboard
    login.tsx               # Email/password login
    dashboard.tsx           # Executive dashboard
    agent.$agentId.tsx      # Agent detail + baselines
    tasks.tsx               # Task log + CSV export
    health.tsx              # Account health scoring
    docs.tsx                # Developer documentation
supabase_setup.sql          # Full database schema + seed data
supabase_reseed_timestamps.sql  # Timestamp distribution script for demo trend
```

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) installed
- A Supabase project (or use Lovable Cloud)

### 1. Install dependencies

```bash
bun install
```

### 2. Set up Supabase

1. Open your Supabase project SQL Editor.
2. Run `supabase_setup.sql` to create the schema, tables, views, RLS policies, indexes, and seed data.
3. Enable the **Email** provider in Supabase Auth and disable **Confirm email**.
4. Create a test user: `demo@zamp.ai` / `ZampDemo2026!`.

### 3. Configure Supabase credentials

The browser client is located at `src/integrations/supabase/client.ts`. Update the URL and publishable key to match your project:

```ts
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "your-publishable-key";
```

For production deployments, move these values into environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) and read them via `import.meta.env`.

### 4. Run the dev server

```bash
bun dev
```

Open `http://localhost:8080` (or the port shown in the terminal). The app redirects `/` to `/login` and then to `/dashboard` after authentication.

## Demo credentials

| Email | Password |
|-------|----------|
| `demo@zamp.ai` | `ZampDemo2026!` |

## Available scripts

| Script | Description |
|--------|-------------|
| `bun dev` | Start development server |
| `bun build` | Production build |
| `bun build:dev` | Development build |
| `bun preview` | Preview production build locally |
| `bun lint` | Run ESLint |
| `bun format` | Format code with Prettier |

## Database schema

The app uses 5 core tables:

- `agents` — AI agents and their role metadata.
- `task_events` — Every task attempt with outcome (`completed`, `escalated`, `corrected`, `failed`), processing time, and timestamps.
- `correction_events` — Human corrections applied to agent output.
- `baselines` — Baseline minutes-per-task for ROI calculations.
- `health_signals` — Static signal definitions (scores are dynamically calculated from `task_events`).

See `supabase_setup.sql` for the full schema, views, RLS policies, and seed data.

## Deployment

This project is built on TanStack Start and can be deployed to any platform that supports Vite-based full-stack React apps (e.g., Lovable hosting, Cloudflare Pages, Vercel, Netlify). Environment variables and Supabase credentials must be configured in the hosting dashboard.

## Contact

For access or questions, contact **rakeshgorkal@gmail.com**.

---

ZampPulse V1
