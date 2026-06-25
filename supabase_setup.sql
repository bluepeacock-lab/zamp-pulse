-- =====================================================================
-- ZampScan — AI Agent Performance Observatory
-- Run this entire file in Supabase SQL Editor (project: ZampScan)
-- =====================================================================

-- ---------- TABLES ----------
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role_icon TEXT NOT NULL,
  account_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  task_subtype TEXT NOT NULL,
  source_system TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  ts_received TIMESTAMPTZ NOT NULL,
  ts_started TIMESTAMPTZ NOT NULL,
  ts_completed TIMESTAMPTZ NOT NULL,
  ts_resolved TIMESTAMPTZ,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed','escalated','corrected','failed')),
  confidence_score DECIMAL NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  escalation_reason TEXT,
  processing_seconds INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.correction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.task_events(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  corrected_field TEXT NOT NULL,
  before_value TEXT NOT NULL,
  after_value TEXT NOT NULL,
  corrected_at TIMESTAMPTZ NOT NULL,
  generalized BOOLEAN NOT NULL DEFAULT false,
  accuracy_impact DECIMAL
);

CREATE TABLE IF NOT EXISTS public.baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workflow_type TEXT NOT NULL,
  tasks_per_week INTEGER NOT NULL,
  minutes_per_task DECIMAL NOT NULL,
  error_rate_pct DECIMAL NOT NULL,
  cost_per_error DECIMAL NOT NULL,
  hourly_cost DECIMAL NOT NULL,
  is_estimated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.health_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL,
  signal_name TEXT NOT NULL,
  signal_value DECIMAL,
  points INTEGER NOT NULL DEFAULT 0,
  triggered BOOLEAN NOT NULL DEFAULT false,
  details TEXT,
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ---------- GRANTS ----------
GRANT SELECT ON public.agents TO authenticated;
GRANT SELECT ON public.task_events TO authenticated;
GRANT SELECT ON public.correction_events TO authenticated;
GRANT SELECT ON public.health_signals TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.baselines TO authenticated;
GRANT ALL ON public.agents, public.task_events, public.correction_events, public.baselines, public.health_signals TO service_role;

-- ---------- RLS ----------
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access" ON public.agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.task_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.correction_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read access" ON public.health_signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.baselines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert" ON public.baselines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update" ON public.baselines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_task_events_agent_ts ON public.task_events(agent_id, ts_received);
CREATE INDEX IF NOT EXISTS idx_task_events_outcome ON public.task_events(outcome);
CREATE INDEX IF NOT EXISTS idx_task_events_ts_received ON public.task_events(ts_received);
CREATE INDEX IF NOT EXISTS idx_correction_events_task ON public.correction_events(task_id);
CREATE INDEX IF NOT EXISTS idx_correction_events_agent ON public.correction_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_baselines_agent ON public.baselines(agent_id);

-- ---------- VIEWS ----------
CREATE OR REPLACE VIEW public.atcr_daily AS
SELECT
  DATE(ts_received) as date,
  agent_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE outcome = 'completed') as autonomous_tasks,
  COUNT(*) FILTER (WHERE outcome = 'escalated') as escalated_tasks,
  COUNT(*) FILTER (WHERE outcome = 'corrected') as corrected_tasks,
  COUNT(*) FILTER (WHERE outcome = 'failed') as failed_tasks,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'completed') * 100.0 / NULLIF(COUNT(*), 0), 1) as atcr,
  ROUND(AVG(confidence_score) * 100, 1) as avg_confidence,
  ROUND(AVG(processing_seconds), 1) as avg_processing_seconds
FROM public.task_events
GROUP BY DATE(ts_received), agent_id
ORDER BY date;

CREATE OR REPLACE VIEW public.atcr_summary AS
SELECT
  agent_id,
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE outcome = 'completed') as autonomous_tasks,
  COUNT(*) FILTER (WHERE outcome = 'escalated') as escalated_tasks,
  COUNT(*) FILTER (WHERE outcome = 'corrected') as corrected_tasks,
  COUNT(*) FILTER (WHERE outcome = 'failed') as failed_tasks,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'completed') * 100.0 / NULLIF(COUNT(*), 0), 1) as atcr,
  ROUND(AVG(confidence_score) * 100, 1) as avg_confidence,
  ROUND(AVG(processing_seconds), 1) as avg_processing_time
FROM public.task_events
GROUP BY agent_id;

GRANT SELECT ON public.atcr_daily TO authenticated;
GRANT SELECT ON public.atcr_summary TO authenticated;

-- ---------- SEED DATA ----------
DO $$
DECLARE
  v_account UUID := gen_random_uuid();
  v_acct_id UUID;
  v_supp_id UUID;
  v_agent_id UUID;
  v_outcome TEXT;
  v_subtype TEXT;
  v_conf DECIMAL;
  v_proc INT;
  v_ts_recv TIMESTAMPTZ;
  v_ts_start TIMESTAMPTZ;
  v_ts_comp TIMESTAMPTZ;
  v_ts_res TIMESTAMPTZ;
  v_reason TEXT;
  v_ref TEXT;
  v_workflow TEXT;
  v_source TEXT;
  v_day INT;
  v_max_day INT;
  v_month_start DATE;
  i INT;
  v_remaining_completed INT;
  v_remaining_escalated INT;
  v_remaining_corrected INT;
  v_remaining_failed INT;
  v_remaining_sub1 INT;
  v_remaining_sub2 INT;
  v_remaining_sub3 INT;
  v_remaining_sub4 INT;
  v_subtypes TEXT[];
  v_acct_reasons TEXT[] := ARRAY[
    'Invoice amount $14,200 exceeds PO #8821 authorized $12,500 by 13.6%. Historical tolerance for this vendor is 5%.',
    'Vendor not found in approved vendor list. Manual verification required.',
    'Duplicate invoice detected — INV-4023 has matching amount and date.',
    'Multi-currency conversion rate differs from treasury rate by >2%.',
    'Expense category could not be determined — receipt description is ambiguous.',
    'PO line items do not match invoice line items. 3-way match failed.'
  ];
  v_supp_reasons TEXT[] := ARRAY[
    'Customer reports recurring billing discrepancy across 3 months. Account-level investigation required.',
    'Technical issue involves third-party integration outside agent''s access scope.',
    'Feature request requires product team evaluation — outside standard support.',
    'Customer expressed frustration and requested human agent. Sentiment below threshold.',
    'Password reset blocked — account flagged for security review after 5 failed attempts.'
  ];
  v_reasons TEXT[];
  v_month INT;
  v_corr_task_ids UUID[];
  v_task_id UUID;
BEGIN
  -- Insert agents with shared account_id
  INSERT INTO public.agents (name, role_icon, account_id)
  VALUES ('Accountant', '🧮', v_account) RETURNING id INTO v_acct_id;
  INSERT INTO public.agents (name, role_icon, account_id)
  VALUES ('Support Specialist', '🎧', v_account) RETURNING id INTO v_supp_id;

  -- Generate task events for both agents, both months
  FOR v_agent_id, v_workflow, v_source, v_reasons IN
    SELECT * FROM (VALUES
      (v_acct_id, 'invoice_processing', 'erp', v_acct_reasons),
      (v_supp_id, 'support_ticket', 'helpdesk', v_supp_reasons)
    ) AS t(aid, wf, src, rsn)
  LOOP
    FOR v_month IN 5..6 LOOP
      IF v_month = 5 THEN
        v_month_start := DATE '2026-05-01';
        v_max_day := 31;
        IF v_agent_id = v_acct_id THEN
          v_remaining_completed := 78; v_remaining_escalated := 13; v_remaining_corrected := 7; v_remaining_failed := 2;
          v_subtypes := ARRAY['standard_invoice','multi_currency_invoice','credit_note','expense_report'];
          v_remaining_sub1 := 55; v_remaining_sub2 := 20; v_remaining_sub3 := 15; v_remaining_sub4 := 10;
        ELSE
          v_remaining_completed := 82; v_remaining_escalated := 11; v_remaining_corrected := 5; v_remaining_failed := 2;
          v_subtypes := ARRAY['password_reset','billing_inquiry','technical_issue','feature_request'];
          v_remaining_sub1 := 30; v_remaining_sub2 := 25; v_remaining_sub3 := 30; v_remaining_sub4 := 15;
        END IF;
      ELSE
        v_month_start := DATE '2026-06-01';
        v_max_day := 23;
        IF v_agent_id = v_acct_id THEN
          v_remaining_completed := 89; v_remaining_escalated := 6; v_remaining_corrected := 4; v_remaining_failed := 1;
          v_subtypes := ARRAY['standard_invoice','multi_currency_invoice','credit_note','expense_report'];
          v_remaining_sub1 := 55; v_remaining_sub2 := 20; v_remaining_sub3 := 15; v_remaining_sub4 := 10;
        ELSE
          v_remaining_completed := 92; v_remaining_escalated := 5; v_remaining_corrected := 2; v_remaining_failed := 1;
          v_subtypes := ARRAY['password_reset','billing_inquiry','technical_issue','feature_request'];
          v_remaining_sub1 := 30; v_remaining_sub2 := 25; v_remaining_sub3 := 30; v_remaining_sub4 := 15;
        END IF;
      END IF;

      FOR i IN 1..100 LOOP
        -- pick outcome
        IF v_remaining_completed > 0 THEN
          v_outcome := 'completed'; v_remaining_completed := v_remaining_completed - 1;
        ELSIF v_remaining_escalated > 0 THEN
          v_outcome := 'escalated'; v_remaining_escalated := v_remaining_escalated - 1;
        ELSIF v_remaining_corrected > 0 THEN
          v_outcome := 'corrected'; v_remaining_corrected := v_remaining_corrected - 1;
        ELSE
          v_outcome := 'failed'; v_remaining_failed := v_remaining_failed - 1;
        END IF;

        -- pick subtype
        IF v_remaining_sub1 > 0 THEN
          v_subtype := v_subtypes[1]; v_remaining_sub1 := v_remaining_sub1 - 1;
        ELSIF v_remaining_sub2 > 0 THEN
          v_subtype := v_subtypes[2]; v_remaining_sub2 := v_remaining_sub2 - 1;
        ELSIF v_remaining_sub3 > 0 THEN
          v_subtype := v_subtypes[3]; v_remaining_sub3 := v_remaining_sub3 - 1;
        ELSE
          v_subtype := v_subtypes[4]; v_remaining_sub4 := v_remaining_sub4 - 1;
        END IF;

        -- confidence + processing based on outcome and month (June improves)
        IF v_month = 5 THEN
          IF v_agent_id = v_acct_id THEN
            CASE v_outcome
              WHEN 'completed' THEN v_conf := 0.75 + random()*0.23; v_proc := 5 + (random()*20)::int;
              WHEN 'escalated' THEN v_conf := 0.45 + random()*0.30; v_proc := 20 + (random()*40)::int;
              WHEN 'corrected' THEN v_conf := 0.70 + random()*0.20; v_proc := 8 + (random()*12)::int;
              ELSE v_conf := 0.30 + random()*0.20; v_proc := 3 + (random()*7)::int;
            END CASE;
          ELSE
            CASE v_outcome
              WHEN 'completed' THEN v_conf := 0.78 + random()*0.20; v_proc := 8 + (random()*27)::int;
              WHEN 'escalated' THEN v_conf := 0.40 + random()*0.32; v_proc := 25 + (random()*35)::int;
              WHEN 'corrected' THEN v_conf := 0.72 + random()*0.16; v_proc := 10 + (random()*15)::int;
              ELSE v_conf := 0.25 + random()*0.20; v_proc := 5 + (random()*10)::int;
            END CASE;
          END IF;
        ELSE
          IF v_agent_id = v_acct_id THEN
            CASE v_outcome
              WHEN 'completed' THEN v_conf := 0.85 + random()*0.14; v_proc := 4 + (random()*14)::int;
              WHEN 'escalated' THEN v_conf := 0.50 + random()*0.28; v_proc := 18 + (random()*32)::int;
              WHEN 'corrected' THEN v_conf := 0.75 + random()*0.17; v_proc := 6 + (random()*9)::int;
              ELSE v_conf := 0.35; v_proc := 5;
            END CASE;
          ELSE
            CASE v_outcome
              WHEN 'completed' THEN v_conf := 0.88 + random()*0.11; v_proc := 5 + (random()*17)::int;
              WHEN 'escalated' THEN v_conf := 0.52 + random()*0.23; v_proc := 15 + (random()*30)::int;
              WHEN 'corrected' THEN v_conf := 0.80 + random()*0.13; v_proc := 8 + (random()*10)::int;
              ELSE v_conf := 0.30; v_proc := 8;
            END CASE;
          END IF;
        END IF;

        v_day := 1 + (random() * (v_max_day - 1))::int;
        v_ts_recv := (v_month_start + (v_day - 1))::timestamptz
                     + (8 * interval '1 hour')
                     + (random() * interval '10 hours');
        v_ts_start := v_ts_recv + ((1 + (random()*2)::int) * interval '1 second');
        v_ts_comp := v_ts_start + (v_proc * interval '1 second');
        v_ts_res := NULL;
        v_reason := NULL;

        IF v_outcome = 'escalated' THEN
          v_ts_res := v_ts_comp + ((30 + (random()*90)::int) * interval '1 minute');
          v_reason := v_reasons[1 + (random()*(array_length(v_reasons,1)-1))::int];
        END IF;

        IF v_agent_id = v_acct_id THEN
          v_ref := 'INV-' || (CASE WHEN v_month=5 THEN 4000 ELSE 5000 END + i)::TEXT;
        ELSE
          v_ref := 'TKT-' || (CASE WHEN v_month=5 THEN 700 ELSE 800 END + i)::TEXT;
        END IF;

        INSERT INTO public.task_events (
          agent_id, workflow_type, task_subtype, source_system, source_reference,
          ts_received, ts_started, ts_completed, ts_resolved, outcome,
          confidence_score, escalation_reason, processing_seconds
        ) VALUES (
          v_agent_id, v_workflow, v_subtype, v_source, v_ref,
          v_ts_recv, v_ts_start, v_ts_comp, v_ts_res, v_outcome,
          ROUND(v_conf::numeric, 4), v_reason, v_proc
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- ---------- CORRECTION EVENTS ----------
  -- Accountant: 11 corrections, link to corrected tasks
  SELECT array_agg(id) INTO v_corr_task_ids FROM (
    SELECT id FROM public.task_events WHERE agent_id = v_acct_id AND outcome = 'corrected' ORDER BY ts_completed LIMIT 11
  ) t;

  INSERT INTO public.correction_events (task_id, agent_id, corrected_field, before_value, after_value, corrected_at, generalized, accuracy_impact)
  SELECT v_corr_task_ids[idx], v_acct_id, field, bef, aft,
         (SELECT ts_completed FROM public.task_events WHERE id = v_corr_task_ids[idx]) + ((15 + (random()*105)::int) * interval '1 minute'),
         gen, impact
  FROM (VALUES
    (1, 'expense_category', 'Consulting', 'Professional Services', true, 8.4),
    (2, 'vendor_code', 'VND-0092', 'VND-0922', false, NULL),
    (3, 'tax_rate', '15%', '18%', true, 5.2),
    (4, 'payment_terms', 'Net 30', 'Net 60', true, 3.1),
    (5, 'gl_account', '6100', '6200', true, 6.7),
    (6, 'currency', 'USD', 'EUR', false, NULL),
    (7, 'invoice_date', '2026-05-15', '2026-05-14', true, 2.0),
    (8, 'expense_category', 'Travel', 'Client Entertainment', true, 4.5),
    (9, 'approval_level', 'Standard', 'Director', true, 3.8),
    (10, 'vendor_code', 'VND-1001', 'VND-1010', false, NULL),
    (11, 'tax_rate', '20%', '21%', true, 2.9)
  ) AS c(idx, field, bef, aft, gen, impact);

  -- Support: 7 corrections
  SELECT array_agg(id) INTO v_corr_task_ids FROM (
    SELECT id FROM public.task_events WHERE agent_id = v_supp_id AND outcome = 'corrected' ORDER BY ts_completed LIMIT 7
  ) t;

  INSERT INTO public.correction_events (task_id, agent_id, corrected_field, before_value, after_value, corrected_at, generalized, accuracy_impact)
  SELECT v_corr_task_ids[idx], v_supp_id, field, bef, aft,
         (SELECT ts_completed FROM public.task_events WHERE id = v_corr_task_ids[idx]) + ((15 + (random()*105)::int) * interval '1 minute'),
         gen, impact
  FROM (VALUES
    (1, 'priority', 'Low', 'High', true, 7.2),
    (2, 'category', 'Billing', 'Account Access', true, 5.8),
    (3, 'resolution_type', 'Self-Service', 'Manual Intervention', false, NULL),
    (4, 'escalation_tier', 'Tier 1', 'Tier 2', true, 4.1),
    (5, 'response_template', 'Generic', 'VIP Customer', true, 6.3),
    (6, 'category', 'Technical', 'Integration', true, 3.5),
    (7, 'priority', 'Medium', 'Urgent', false, NULL)
  ) AS c(idx, field, bef, aft, gen, impact);

  -- ---------- BASELINES ----------
  INSERT INTO public.baselines (agent_id, workflow_type, tasks_per_week, minutes_per_task, error_rate_pct, cost_per_error, hourly_cost, is_estimated)
  VALUES
    (v_acct_id, 'invoice_processing', 60, 15, 3.0, 50, 45, false),
    (v_supp_id, 'support_ticket', 50, 8, 5.0, 25, 35, false);

  -- ---------- HEALTH SIGNALS ----------
  INSERT INTO public.health_signals (account_id, signal_name, signal_value, points, triggered, details) VALUES
    (v_account, 'task_volume_decline', -2.0, 0, false, 'Volume stable: -2% vs 4-week average'),
    (v_account, 'rising_corrections', -3.5, 0, false, 'Correction rate declining: 6% → 3% over 60 days'),
    (v_account, 'stuck_escalations', -4.0, 0, false, 'Escalation rate declining: 12% → 5.5% over 60 days'),
    (v_account, 'engagement_drop', 0.0, 0, false, 'Dashboard visits: 4x/week (consistent)'),
    (v_account, 'report_unopened', 0.0, 0, false, 'June report opened by 2 recipients'),
    (v_account, 'missing_baseline', 0.0, 0, false, 'Both agent baselines captured');
END $$;
