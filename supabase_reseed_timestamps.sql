-- ZampScan: redistribute task_events timestamps & outcomes per agent
-- Run in Supabase SQL Editor. Safe to re-run.

BEGIN;

WITH agents AS (
  SELECT id, name FROM public.agents
),
numbered AS (
  SELECT
    te.id,
    te.agent_id,
    a.name AS agent_name,
    row_number() OVER (PARTITION BY te.agent_id ORDER BY te.source_reference) AS i,
    count(*) OVER (PARTITION BY te.agent_id) AS n
  FROM public.task_events te
  JOIN agents a ON a.id = te.agent_id
),
computed AS (
  SELECT
    id,
    agent_id,
    agent_name,
    i,
    n,
    CASE WHEN i <= n/2 THEN 'may' ELSE 'jun' END AS cohort,
    -- Scatter offset differs per agent so the two agents get distinct ATCRs
    ((i * 37 + CASE
                  WHEN agent_name ILIKE 'Accountant%' THEN 3
                  WHEN agent_name ILIKE 'Support%' THEN 17
                  ELSE 0
                END) % 100) + 1 AS scatter,
    CASE
      WHEN i <= n/2 THEN make_timestamptz(
        2026, 5,
        1 + ((i - 1) * 31 / (n/2)),
        8 + ((i * 7) % 10),
        (i * 13) % 60,
        ((i * 17) % 60)::double precision,
        'UTC'
      )
      ELSE make_timestamptz(
        2026, 6,
        1 + ((i - n/2 - 1) * 23 / (n - n/2)),
        8 + ((i * 7) % 10),
        (i * 13) % 60,
        ((i * 17) % 60)::double precision,
        'UTC'
      )
    END AS new_ts_received,
    1 + ((i * 11) % 3) AS start_delay_s,
    30 + ((i * 23) % 91) AS resolve_minutes
  FROM numbered
),
with_outcome AS (
  SELECT
    c.*,
    CASE
      WHEN agent_name ILIKE 'Accountant%' THEN
        CASE
          WHEN cohort = 'may' THEN
            CASE WHEN scatter <= 82 THEN 'completed'
                 WHEN scatter <= 90 THEN 'escalated'
                 WHEN scatter <= 97 THEN 'corrected'
                 ELSE 'failed' END
          ELSE
            CASE WHEN scatter <= 92 THEN 'completed'
                 WHEN scatter <= 96 THEN 'escalated'
                 WHEN scatter <= 99 THEN 'corrected'
                 ELSE 'failed' END
        END
      WHEN agent_name ILIKE 'Support%' THEN
        CASE
          WHEN cohort = 'may' THEN
            CASE WHEN scatter <= 76 THEN 'completed'
                 WHEN scatter <= 86 THEN 'escalated'
                 WHEN scatter <= 95 THEN 'corrected'
                 ELSE 'failed' END
          ELSE
            CASE WHEN scatter <= 86 THEN 'completed'
                 WHEN scatter <= 93 THEN 'escalated'
                 WHEN scatter <= 98 THEN 'corrected'
                 ELSE 'failed' END
        END
      ELSE
        CASE WHEN scatter <= 80 THEN 'completed'
             WHEN scatter <= 88 THEN 'escalated'
             WHEN scatter <= 96 THEN 'corrected'
             ELSE 'failed' END
    END AS new_outcome
  FROM computed c
)
UPDATE public.task_events te
SET
  ts_received  = w.new_ts_received,
  ts_started   = w.new_ts_received + (w.start_delay_s || ' seconds')::interval,
  ts_completed = w.new_ts_received
                  + (w.start_delay_s || ' seconds')::interval
                  + (COALESCE(te.processing_seconds, 30) || ' seconds')::interval,
  ts_resolved  = CASE
    WHEN w.new_outcome = 'escalated'
    THEN w.new_ts_received
         + (w.start_delay_s || ' seconds')::interval
         + (COALESCE(te.processing_seconds, 30) || ' seconds')::interval
         + (w.resolve_minutes || ' minutes')::interval
    ELSE NULL
  END,
  outcome = w.new_outcome,
  created_at = w.new_ts_received
FROM with_outcome w
WHERE te.id = w.id;

COMMIT;

-- Verify per-agent monthly outcomes
SELECT
  a.name,
  date_trunc('month', te.ts_received)::date AS month,
  te.outcome,
  count(*)
FROM public.task_events te
JOIN public.agents a ON a.id = te.agent_id
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
