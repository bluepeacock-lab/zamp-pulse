-- ZampScan: redistribute task_events timestamps & outcomes
-- Run in Supabase SQL Editor. Safe to re-run.

BEGIN;

WITH numbered AS (
  SELECT
    id,
    task_id,
    CASE
      WHEN task_id LIKE 'INV-4%' THEN 'acc_may'
      WHEN task_id LIKE 'INV-5%' THEN 'acc_jun'
      WHEN task_id LIKE 'TKT-7%' THEN 'sup_may'
      WHEN task_id LIKE 'TKT-8%' THEN 'sup_jun'
    END AS cohort,
    CASE
      WHEN task_id LIKE 'INV-4%' THEN (substring(task_id from 5)::int - 4000)
      WHEN task_id LIKE 'INV-5%' THEN (substring(task_id from 5)::int - 5000)
      WHEN task_id LIKE 'TKT-7%' THEN (substring(task_id from 5)::int - 700)
      WHEN task_id LIKE 'TKT-8%' THEN (substring(task_id from 5)::int - 800)
    END AS i
  FROM public.task_events
),
computed AS (
  SELECT
    id,
    cohort,
    i,
    ((i * 37) % 100) + 1 AS scatter,
    CASE
      WHEN cohort IN ('acc_may','sup_may') THEN
        make_timestamptz(
          2026, 5,
          1 + ((i - 1) * 31 / 100),
          8 + ((i * 7) % 10),
          (i * 13) % 60,
          ((i * 17) % 60)::double precision,
          'UTC'
        )
      WHEN cohort IN ('acc_jun','sup_jun') THEN
        make_timestamptz(
          2026, 6,
          1 + ((i - 1) * 23 / 100),
          8 + ((i * 7) % 10),
          (i * 13) % 60,
          ((i * 17) % 60)::double precision,
          'UTC'
        )
    END AS new_ts_received,
    1 + ((i * 11) % 3) AS start_delay_s,
    30 + ((i * 23) % 91) AS resolve_minutes
  FROM numbered
  WHERE cohort IS NOT NULL
)
UPDATE public.task_events te
SET
  ts_received  = c.new_ts_received,
  ts_started   = c.new_ts_received + (c.start_delay_s || ' seconds')::interval,
  ts_completed = c.new_ts_received
                  + (c.start_delay_s || ' seconds')::interval
                  + (COALESCE(te.processing_seconds, 30) || ' seconds')::interval,
  ts_resolved  = CASE
    WHEN (
      CASE
        WHEN c.cohort IN ('acc_may','sup_may') THEN
          CASE WHEN c.scatter <= 80 THEN 'completed'
               WHEN c.scatter <= 88 THEN 'escalated'
               WHEN c.scatter <= 96 THEN 'corrected'
               ELSE 'failed' END
        ELSE
          CASE WHEN c.scatter <= 90 THEN 'completed'
               WHEN c.scatter <= 95 THEN 'escalated'
               WHEN c.scatter <= 98 THEN 'corrected'
               ELSE 'failed' END
      END
    ) = 'escalated'
    THEN c.new_ts_received
         + (c.start_delay_s || ' seconds')::interval
         + (COALESCE(te.processing_seconds, 30) || ' seconds')::interval
         + (c.resolve_minutes || ' minutes')::interval
    ELSE NULL
  END,
  outcome = CASE
    WHEN c.cohort IN ('acc_may','sup_may') THEN
      CASE WHEN c.scatter <= 80 THEN 'completed'
           WHEN c.scatter <= 88 THEN 'escalated'
           WHEN c.scatter <= 96 THEN 'corrected'
           ELSE 'failed' END
    ELSE
      CASE WHEN c.scatter <= 90 THEN 'completed'
           WHEN c.scatter <= 95 THEN 'escalated'
           WHEN c.scatter <= 98 THEN 'corrected'
           ELSE 'failed' END
  END,
  created_at = c.new_ts_received
FROM computed c
WHERE te.id = c.id;

COMMIT;

-- Verify
SELECT
  date_trunc('month', ts_received)::date AS month,
  outcome,
  count(*)
FROM public.task_events
GROUP BY 1, 2
ORDER BY 1, 2;
