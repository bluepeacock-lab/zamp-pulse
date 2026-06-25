import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Code2, ArrowRight, ArrowLeft, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
});

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "tenancy", label: "Clients & Tenancy" },
  { id: "architecture", label: "Architecture" },
  { id: "data-flow", label: "Data Flow" },
  { id: "schema", label: "Database Schema" },
  { id: "integration", label: "Integration Guide" },
  { id: "pages", label: "Page Reference" },
  { id: "glossary", label: "Glossary" },
];

function CodeBlock({ code, language = "javascript" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-gray-500">
          {language}
        </span>
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-1 text-xs text-gray-300 hover:text-white bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-md px-2 py-1 transition-colors"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 pt-10 font-mono text-xs sm:text-sm overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function SectionHeading({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h2 id={id} className="scroll-mt-24 text-2xl font-semibold text-gray-900">
        {title}
      </h2>
      {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      <div className="mt-4 border-b border-gray-200" />
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {children}
    </div>
  );
}

type SchemaRow = { field: string; type: string; required: string; description: string };
function SchemaTable({ rows }: { rows: SchemaRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Field</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Required</th>
              <th className="text-left px-4 py-3 font-medium">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.field} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 font-mono text-xs text-gray-900">{r.field}</td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-600">{r.type}</td>
                <td className="px-4 py-3 text-gray-600">{r.required}</td>
                <td className="px-4 py-3 text-gray-600">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const AGENTS_ROWS: SchemaRow[] = [
  { field: "id", type: "UUID", required: "auto", description: "Primary key, auto-generated" },
  { field: "name", type: "text", required: "✓", description: 'Display name (e.g., "Accountant")' },
  { field: "role_icon", type: "text", required: "✓", description: 'Emoji for dashboard cards (e.g., "🧮")' },
  { field: "account_id", type: "UUID", required: "✓", description: "Your organization identifier" },
  { field: "status", type: "text", required: "—", description: 'Default: "active"' },
  { field: "created_at", type: "timestamptz", required: "auto", description: "Auto-set on insert" },
];

const TASK_EVENTS_ROWS: SchemaRow[] = [
  { field: "id", type: "UUID", required: "auto", description: "Primary key" },
  { field: "agent_id", type: "UUID", required: "✓", description: "FK → agents.id" },
  { field: "workflow_type", type: "text", required: "✓", description: 'Category: "invoice_processing", "support_ticket"' },
  { field: "task_subtype", type: "text", required: "✓", description: 'Specific type: "standard_invoice", "billing_inquiry"' },
  { field: "source_system", type: "text", required: "✓", description: 'Origin: "erp", "email", "helpdesk"' },
  { field: "source_reference", type: "text", required: "✓", description: 'Unique ID from source: "INV-5201", "TKT-901"' },
  { field: "ts_received", type: "timestamptz", required: "✓", description: "When task entered the agent's queue" },
  { field: "ts_started", type: "timestamptz", required: "✓", description: "When agent began processing" },
  { field: "ts_completed", type: "timestamptz", required: "✓", description: "When agent finished or escalated" },
  { field: "ts_resolved", type: "timestamptz", required: "—", description: "When human resolved escalation (null if autonomous)" },
  { field: "outcome", type: "text", required: "✓", description: '"completed" · "escalated" · "corrected" · "failed"' },
  { field: "confidence_score", type: "decimal", required: "✓", description: "0.0 to 1.0 — agent's certainty" },
  { field: "escalation_reason", type: "text", required: "—", description: "Natural language explanation (escalated tasks only)" },
  { field: "processing_seconds", type: "integer", required: "✓", description: "Time the agent spent processing" },
];

const CORRECTION_ROWS: SchemaRow[] = [
  { field: "id", type: "UUID", required: "auto", description: "Primary key" },
  { field: "task_id", type: "UUID", required: "✓", description: "FK → task_events.id (the task that was corrected)" },
  { field: "agent_id", type: "UUID", required: "✓", description: "FK → agents.id" },
  { field: "corrected_field", type: "text", required: "✓", description: 'What was wrong: "expense_category", "priority"' },
  { field: "before_value", type: "text", required: "✓", description: "What the agent put" },
  { field: "after_value", type: "text", required: "✓", description: "What the human changed it to" },
  { field: "corrected_at", type: "timestamptz", required: "✓", description: "When the correction was made" },
  { field: "generalized", type: "boolean", required: "✓", description: "Did this correction improve future similar tasks?" },
  { field: "accuracy_impact", type: "decimal", required: "—", description: "Percentage improvement on similar tasks" },
];

const BASELINE_ROWS: SchemaRow[] = [
  { field: "id", type: "UUID", required: "auto", description: "Primary key" },
  { field: "agent_id", type: "UUID", required: "✓", description: "FK → agents.id" },
  { field: "workflow_type", type: "text", required: "✓", description: "Must match task_events.workflow_type" },
  { field: "tasks_per_week", type: "integer", required: "✓", description: "How many tasks the human team handled weekly" },
  { field: "minutes_per_task", type: "decimal", required: "✓", description: "Average human time per task" },
  { field: "error_rate_pct", type: "decimal", required: "✓", description: "Human error rate (e.g., 3.0 = 3%)" },
  { field: "cost_per_error", type: "decimal", required: "✓", description: "Dollar cost of one error" },
  { field: "hourly_cost", type: "decimal", required: "✓", description: "Fully loaded hourly cost per team member" },
  { field: "is_estimated", type: "boolean", required: "—", description: "True if using industry benchmarks" },
];

const HEALTH_ROWS: SchemaRow[] = [
  { field: "id", type: "UUID", required: "auto", description: "Primary key" },
  { field: "account_id", type: "UUID", required: "✓", description: "Organization identifier" },
  { field: "signal_name", type: "text", required: "✓", description: "Signal key (see glossary)" },
  { field: "signal_value", type: "decimal", required: "—", description: "Current measurement" },
  { field: "points", type: "integer", required: "✓", description: "Churn risk points (0 if healthy)" },
  { field: "triggered", type: "boolean", required: "✓", description: "Is this signal firing?" },
  { field: "details", type: "text", required: "—", description: "Human-readable status description" },
];

const CODE_CONNECT = `import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)`;

const CODE_REGISTER = `const { data: agent } = await supabase
  .from('agents')
  .insert({
    name: 'Revenue Analyst',
    role_icon: '📊',
    account_id: 'your-org-uuid'
  })
  .select()
  .single()

// Save agent.id for all future task events
const AGENT_ID = agent.id`;

const CODE_COMPLETED = `await supabase.from('task_events').insert({
  agent_id: AGENT_ID,
  workflow_type: 'invoice_processing',
  task_subtype: 'standard_invoice',
  source_system: 'erp',
  source_reference: 'INV-6001',
  ts_received: new Date().toISOString(),
  ts_started: new Date(Date.now() + 1000).toISOString(),
  ts_completed: new Date(Date.now() + 9000).toISOString(),
  ts_resolved: null,
  outcome: 'completed',
  confidence_score: 0.96,
  escalation_reason: null,
  processing_seconds: 8
})`;

const CODE_ESCALATED = `await supabase.from('task_events').insert({
  agent_id: AGENT_ID,
  workflow_type: 'invoice_processing',
  task_subtype: 'multi_currency_invoice',
  source_system: 'erp',
  source_reference: 'INV-6002',
  ts_received: new Date().toISOString(),
  ts_started: new Date(Date.now() + 2000).toISOString(),
  ts_completed: new Date(Date.now() + 44000).toISOString(),
  ts_resolved: null,  // Updated when human resolves
  outcome: 'escalated',
  confidence_score: 0.58,
  escalation_reason: 'Invoice amount exceeds PO by 13.6%. Vendor tolerance is 5%.',
  processing_seconds: 42
})

// When human resolves:
await supabase.from('task_events')
  .update({ ts_resolved: new Date().toISOString() })
  .eq('source_reference', 'INV-6002')`;

const CODE_CORRECTED = `// Insert the task
const { data: task } = await supabase
  .from('task_events')
  .insert({
    agent_id: AGENT_ID,
    workflow_type: 'invoice_processing',
    task_subtype: 'expense_report',
    source_system: 'erp',
    source_reference: 'INV-6003',
    ts_received: new Date().toISOString(),
    ts_started: new Date(Date.now() + 1000).toISOString(),
    ts_completed: new Date(Date.now() + 13000).toISOString(),
    ts_resolved: null,
    outcome: 'corrected',
    confidence_score: 0.82,
    escalation_reason: null,
    processing_seconds: 12
  })
  .select().single()

// Then log the correction detail
await supabase.from('correction_events').insert({
  task_id: task.id,
  agent_id: AGENT_ID,
  corrected_field: 'expense_category',
  before_value: 'Consulting',
  after_value: 'Professional Services',
  corrected_at: new Date().toISOString(),
  generalized: true,
  accuracy_impact: 8.4
})`;

const CODE_FAILED = `await supabase.from('task_events').insert({
  agent_id: AGENT_ID,
  workflow_type: 'invoice_processing',
  task_subtype: 'standard_invoice',
  source_system: 'erp',
  source_reference: 'INV-6004',
  ts_received: new Date().toISOString(),
  ts_started: new Date(Date.now() + 1000).toISOString(),
  ts_completed: new Date(Date.now() + 6000).toISOString(),
  ts_resolved: null,
  outcome: 'failed',
  confidence_score: 0.28,
  escalation_reason: 'OCR extraction failed. Document unreadable.',
  processing_seconds: 5
})`;

const TABS = [
  { key: "completed", label: "Completed", code: CODE_COMPLETED },
  { key: "escalated", label: "Escalated", code: CODE_ESCALATED },
  { key: "corrected", label: "Corrected", code: CODE_CORRECTED },
  { key: "failed", label: "Failed", code: CODE_FAILED },
];

function TabbedExamples() {
  const [active, setActive] = useState("completed");
  const current = TABS.find((t) => t.key === active)!;
  return (
    <div>
      <div className="flex flex-wrap gap-1 border-b border-gray-200 mb-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
              (active === t.key
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-gray-500 hover:text-gray-900")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.code} />
    </div>
  );
}

const GLOSSARY: { term: string; def: string }[] = [
  { term: "ATCR", def: "Autonomous Task Completion Rate. The percentage of tasks an agent handles end-to-end without any human involvement. ZampPulse's North Star metric." },
  { term: "Autonomous Task", def: "A task where outcome = 'completed' and no correction was applied. The human never touched it." },
  { term: "Escalation", def: "When the agent routes a task to a human because its confidence is too low to act autonomously. A sign of good judgment, not failure." },
  { term: "Correction", def: "When a human fixes the agent's completed output after the fact. Indicates the agent was confident but wrong." },
  { term: "Generalized Correction", def: "A correction that improved the agent's accuracy on similar future tasks. Measured by the accuracy_impact field." },
  { term: "Confidence Score", def: "A 0.0–1.0 score representing how certain the agent was about its output. Low confidence + escalation = appropriate caution. High confidence + correction = calibration problem." },
  { term: "Baseline", def: "The human performance benchmark captured before Zamp. Used to calculate ROI: hours saved, cost saved, errors prevented." },
  { term: "Health Score", def: "A 0–100 churn risk score computed from 6 operational signals. Higher = more risk." },
  { term: "Processing Seconds", def: "Wall-clock time the agent spent on a task from ts_started to ts_completed. Does not include queue wait time or human review time." },
  { term: "Task Subtype", def: "A specific category within a workflow type. E.g., within \"invoice_processing\": standard_invoice, multi_currency_invoice, credit_note, expense_report." },
  { term: "Workflow Type", def: "The broad category of work an agent handles. E.g., \"invoice_processing\" or \"support_ticket\". One agent typically has one workflow type." },
  { term: "ROI Panel", def: "The financial impact section on the Agent Detail page. Only visible when a baseline exists. Shows hours saved, cost saved, and errors prevented." },
  { term: "Coaching Impact", def: "The count of human corrections and what percentage of them generalized (improved future accuracy). Displayed on the dashboard." },
];

function DocsPage() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    observers.push(obs);
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    }
  };

  const principles = useMemo(
    () => [
      { title: "Event-Driven", body: "Agents push events. The dashboard pulls metrics. No polling, no webhooks needed." },
      { title: "Schema-First", body: "4 event types, 5 tables, strict validation. If the data is right, the dashboard is right." },
      { title: "SOC 2 Ready", body: "RLS on every table. Auth required. Audit trail built into the data model." },
    ],
    [],
  );

  const steps = [
    { n: 1, title: "Agent Receives Task", body: "Agent logs task_id, source, timestamps.", event: "task_events INSERT" },
    { n: 2, title: "Agent Processes Task", body: "Agent determines outcome, confidence, reasoning.", event: "completed | escalated | corrected | failed" },
    { n: 3, title: "Human Reviews (if escalated)", body: "Human resolves the escalation.", event: "task_events UPDATE (ts_resolved)" },
    { n: 4, title: "Human Corrects (if wrong)", body: "Human fixes the agent's output.", event: "correction_events INSERT" },
    { n: 5, title: "Dashboard Reads", body: "Calculates ATCR, accuracy, trends, health score. All computation happens at read time.", event: "SELECT (read-only)" },
  ];

  const pages = [
    { route: "/dashboard", title: "Dashboard", body: "Portfolio view. Aggregate ATCR across all agents, 4 summary metrics, trend chart, one card per agent.", source: "task_events (all), agents, correction_events, baselines", metric: "Global ATCR = completed ÷ total × 100" },
    { route: "/agent/:id", title: "Agent Detail", body: "Deep dive into one agent. ATCR by subtype, trend charts, ROI panel, recent tasks.", source: "task_events (filtered), corrections, baseline", metric: "Per-agent ATCR + per-subtype breakdown" },
    { route: "/tasks", title: "Task Log", body: "Searchable audit trail. Filter by agent, outcome, date, subtype. Expandable rows with full detail.", source: "task_events (all), correction_events", metric: "CSV export of filtered results" },
    { route: "/health", title: "Account Health", body: "Internal churn risk scoring. 6 signals scored 0–100 with recommended CSM actions per band.", source: "health_signals, task_events, baselines", metric: "Bands: Healthy 0-15 · Monitor 16-35 · At Risk 36-55 · Critical 56+" },
    { route: "/docs", title: "Developer Docs", body: "This page. Architecture, schema, integration guide, and glossary.", source: "Static documentation", metric: "—" },
  ];

  return (
    <div ref={containerRef} className="flex flex-col lg:flex-row gap-6">
      {/* Mobile section selector */}
      <div className="lg:hidden">
        <label className="text-xs uppercase tracking-wider text-gray-500 mb-1 block">
          Jump to section
        </label>
        <select
          value={activeId}
          onChange={(e) => {
            setActiveId(e.target.value);
            scrollTo(e.target.value);
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-white text-sm"
        >
          {SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Sidebar */}
      <aside className="hidden lg:block w-[220px] shrink-0">
        <div className="sticky top-6">
          <div className="flex items-center gap-2 mb-3 text-indigo-600">
            <Code2 className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-semibold">Developer Docs</span>
          </div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((s) => {
              const active = activeId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  className={
                    "text-left text-sm px-3 py-2 rounded-md border-l-2 transition-colors " +
                    (active
                      ? "border-teal-500 bg-teal-50 text-teal-700 font-medium"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50")
                  }
                >
                  {s.label}
                </button>
              );
            })}
          </nav>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Back to Dashboard</span>
            <ArrowLeft className="h-3.5 w-3.5 -ml-0.5 opacity-70" />
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 space-y-16">
        <div className="lg:hidden">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Back to Dashboard</span>
            <ArrowLeft className="h-3.5 w-3.5 -ml-0.5 opacity-70" />
          </Link>
        </div>

        {/* Overview */}
        <section>
          <div className="mb-6">
            <div className="hidden lg:flex items-center justify-between mb-2">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Back to Dashboard</span>
                <ArrowLeft className="h-3.5 w-3.5 -ml-0.5 opacity-70" />
              </Link>
            </div>
            <h1 id="overview" className="scroll-mt-24 text-3xl font-semibold text-gray-900">
              ZampPulse Developer Docs
            </h1>
            <p className="text-gray-500 mt-2">
              Everything you need to integrate AI agents with ZampPulse.
            </p>
            <div className="mt-4 border-b border-gray-200" />
          </div>
          <Card className="p-6 mb-6">
            <p className="text-gray-700 leading-relaxed">
              ZampPulse is a read-heavy analytics layer. AI agents push structured events into
              the database as they process tasks. The dashboard reads this data and calculates all
              metrics — ATCR, accuracy, escalation rate, coaching impact, ROI, and churn risk —
              automatically. No additional configuration needed. Insert a row, and the dashboard
              reflects it.
            </p>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {principles.map((p) => (
              <Card key={p.title} className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section>
          <SectionHeading id="architecture" title="System Architecture" />
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {[
              { title: "AI Agents", role: "WRITE", items: ["Accountant", "Support Specialist", "Any new agent"] },
              { title: "Supabase (PostgreSQL)", role: "STORE", items: ["task_events", "correction_events", "baselines"] },
              { title: "ZampPulse Dashboard", role: "READ", items: ["ATCR", "Trends", "Health"] },
            ].map((node, idx, arr) => (
              <div key={node.title} className="flex-1 flex items-center gap-3">
                <Card className="flex-1 p-5">
                  <div className="text-xs uppercase tracking-wider text-teal-600 font-semibold mb-2">
                    {node.role}
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">{node.title}</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {node.items.map((i) => (
                      <li key={i}>• {i}</li>
                    ))}
                  </ul>
                </Card>
                {idx < arr.length - 1 && (
                  <ArrowRight className="hidden md:block h-5 w-5 text-teal-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
          <Card className="p-5 mt-6">
            <p className="text-sm text-gray-700 leading-relaxed">
              ZampPulse is decoupled from agent logic. Agents don't need to know about the
              dashboard. They just push events into the database using the Supabase client. The
              dashboard reads and computes everything independently.
            </p>
          </Card>
        </section>

        {/* Data Flow */}
        <section>
          <SectionHeading id="data-flow" title="Data Flow: From Agent Action to Dashboard Metric" />
          <div className="space-y-3">
            {steps.map((s) => (
              <Card key={s.n} className="p-5 flex gap-4 items-start">
                <div className="h-8 w-8 rounded-full bg-teal-500 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                  {s.n}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{s.body}</p>
                  <span className="inline-block mt-2 font-mono text-[11px] bg-gray-900 text-gray-100 px-2 py-1 rounded">
                    {s.event}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Schema */}
        <section>
          <SectionHeading id="schema" title="Database Schema" />

          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-mono">agents</h3>
              <p className="text-sm text-gray-500 mb-3">
                One row per AI agent. Register an agent before it can push task events.
              </p>
              <SchemaTable rows={AGENTS_ROWS} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-mono">task_events</h3>
              <p className="text-sm text-gray-500 mb-3">
                One row per task processed. This is the core table that powers ATCR.
              </p>
              <SchemaTable rows={TASK_EVENTS_ROWS} />
              <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm text-teal-900">
                📌 ATCR counts only tasks where <span className="font-mono">outcome = 'completed'</span>{" "}
                as autonomous. Every other outcome (escalated, corrected, failed) means a human was
                involved.
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-mono">correction_events</h3>
              <p className="text-sm text-gray-500 mb-3">
                One row per human correction. Links to the task that was wrong.
              </p>
              <SchemaTable rows={CORRECTION_ROWS} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-mono">baselines</h3>
              <p className="text-sm text-gray-500 mb-3">
                One row per agent per workflow. The human performance anchor for ROI calculations.
              </p>
              <SchemaTable rows={BASELINE_ROWS} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 font-mono">health_signals</h3>
              <p className="text-sm text-gray-500 mb-3">
                One row per churn signal. Updated daily by the system.
              </p>
              <SchemaTable rows={HEALTH_ROWS} />
            </div>
          </div>
        </section>

        {/* Integration */}
        <section>
          <SectionHeading
            id="integration"
            title="Integration Guide"
            subtitle="Push data from your agents in 3 steps"
          />

          <div className="space-y-8">
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Step 1: Connect</h3>
              <CodeBlock code={CODE_CONNECT} />
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
                ⚠ Use the <span className="font-mono">service_role</span> key for server-side agent
                integrations. Never expose this key in frontend code.
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Step 2: Register Your Agent (one-time)
              </h3>
              <CodeBlock code={CODE_REGISTER} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Step 3: Push Task Events</h3>
              <TabbedExamples />
            </div>
          </div>
        </section>

        {/* Page Reference */}
        <section>
          <SectionHeading
            id="pages"
            title="ZampPulse Pages"
            subtitle="What each page shows and how it uses the data"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pages.map((p) => (
              <Card key={p.route} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-semibold text-gray-900">{p.title}</h3>
                  <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {p.route}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{p.body}</p>
                <dl className="text-xs space-y-1.5">
                  <div className="flex gap-2">
                    <dt className="text-gray-500 shrink-0 w-20">Source:</dt>
                    <dd className="text-gray-700 font-mono">{p.source}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-500 shrink-0 w-20">Key:</dt>
                    <dd className="text-gray-700">{p.metric}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        </section>

        {/* Glossary */}
        <section>
          <SectionHeading id="glossary" title="Glossary" />
          <Card className="overflow-hidden">
            <dl className="divide-y divide-gray-100">
              {GLOSSARY.map((g, i) => (
                <div
                  key={g.term}
                  className={"px-5 py-4 " + (i % 2 === 0 ? "bg-white" : "bg-gray-50/60")}
                >
                  <dt className="font-semibold text-gray-900 text-sm">{g.term}</dt>
                  <dd className="text-sm text-gray-600 mt-1 leading-relaxed">{g.def}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-4 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            ZampPulse V1. For access Contact: rakeshgorkal@gmail.com
          </p>
        </footer>
      </div>
    </div>
  );
}
