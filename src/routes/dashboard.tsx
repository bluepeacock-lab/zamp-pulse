import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/lib/client-context";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · ZampPulse" }] }),
  component: DashboardPage,
});

const TEAL = "#00C9A7";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const RED = "#EF4444";
const GRAY_500 = "#6B7280";
const GRAY_900 = "#1A1A1A";

type TaskEvent = {
  id: string;
  agent_id: string;
  outcome: string; // 'completed' | 'escalated' | 'corrected' | 'failed'
  processing_seconds: number | null;
  created_at: string;
};
type Agent = {
  id: string;
  name: string;
  role_icon: string;
  status: string | null;
};
type CorrectionEvent = {
  id: string;
  agent_id: string;
  generalized: boolean | null;
  created_at: string;
};
type Baseline = {
  id: string;
  agent_id: string;
  minutes_per_task: number | null;
};

function colorForAtcr(v: number) {
  if (v > 90) return GREEN;
  if (v >= 75) return AMBER;
  return RED;
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function formatShortDate(d: string) {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function computeAtcr(tasks: TaskEvent[]) {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.outcome === "completed").length;
  return (completed / tasks.length) * 100;
}

function filterByDays(tasks: TaskEvent[], days: number | null) {
  if (days === null) return tasks;
  const cutoff = Date.now() - days * 86400000;
  return tasks.filter((t) => new Date(t.created_at).getTime() >= cutoff);
}

function priorPeriod(tasks: TaskEvent[], days: number) {
  const now = Date.now();
  const start = now - days * 2 * 86400000;
  const end = now - days * 86400000;
  return tasks.filter((t) => {
    const ts = new Date(t.created_at).getTime();
    return ts >= start && ts < end;
  });
}

function dailyAtcr(tasks: TaskEvent[], rollingWindow = 1) {
  const buckets = new Map<string, { total: number; completed: number }>();
  for (const t of tasks) {
    const k = dayKey(t.created_at);
    const b = buckets.get(k) ?? { total: 0, completed: 0 };
    b.total += 1;
    if (t.outcome === "completed") b.completed += 1;
    buckets.set(k, b);
  }
  const raw = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, { total, completed }]) => ({
      date,
      atcrRaw: total ? (completed / total) * 100 : 0,
      completed,
      total,
    }));
  return raw.map((d, i) => {
    const start = Math.max(0, i - rollingWindow + 1);
    const window = raw.slice(start, i + 1);
    const c = window.reduce((a, x) => a + x.completed, 0);
    const t = window.reduce((a, x) => a + x.total, 0);
    return {
      date: d.date,
      atcr: t ? (c / t) * 100 : 0,
      atcrRaw: d.atcrRaw,
      tasks: d.total,
    };
  });
}

function SkeletonCard({ h = "h-24" }: { h?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm p-5 ${h} animate-pulse`} />;
}

function DashboardPage() {
  const { activeClient } = useClient();
  const clientId = activeClient?.id;
  const [tasks, setTasks] = useState<TaskEvent[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [corrections, setCorrections] = useState<CorrectionEvent[] | null>(null);
  const [baselines, setBaselines] = useState<Baseline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 60>(30);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    setError(null);
    setTasks(null);
    setAgents(null);
    setCorrections(null);
    setBaselines(null);
    (async () => {
      try {
        const [t, a, c, b] = await Promise.all([
          supabase.from("task_events").select("*").eq("client_id", clientId),
          supabase.from("agents").select("*").eq("client_id", clientId),
          supabase.from("correction_events").select("*").eq("client_id", clientId),
          supabase.from("baselines").select("*").eq("client_id", clientId),
        ]);
        if (cancelled) return;
        if (t.error) throw t.error;
        if (a.error) throw a.error;
        if (c.error) throw c.error;
        if (b.error) throw b.error;
        const taskRows = (t.data ?? []) as TaskEvent[];
        setTasks(taskRows);
        setAgents((a.data ?? []) as Agent[]);
        setCorrections((c.data ?? []) as CorrectionEvent[]);
        setBaselines((b.data ?? []) as Baseline[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, clientId]);

  const loading = !error && (!tasks || !agents || !corrections || !baselines);

  if (error) {
    return (
      <Layout>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <h2 className="text-lg font-semibold mb-2" style={{ color: GRAY_900 }}>
            Unable to load dashboard data
          </h2>
          <p className="text-sm mb-4" style={{ color: GRAY_500 }}>{error}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: TEAL }}
          >
            Retry
          </button>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="space-y-4">
          <SkeletonCard h="h-40" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <SkeletonCard h="h-80" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard h="h-48" /><SkeletonCard h="h-48" /><SkeletonCard h="h-48" />
          </div>
        </div>
      </Layout>
    );
  }

  if (tasks!.length === 0) {
    return (
      <Layout>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center" style={{ color: GRAY_500 }}>
          No task data available yet
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <DashboardContent
        tasks={tasks!}
        agents={agents!}
        corrections={corrections!}
        baselines={baselines!}
        period={period}
        setPeriod={setPeriod}
      />
    </Layout>
  );
}

function DashboardContent({
  tasks,
  agents,
  corrections,
  baselines,
  period,
  setPeriod,
}: {
  tasks: TaskEvent[];
  agents: Agent[];
  corrections: CorrectionEvent[];
  baselines: Baseline[];
  period: 7 | 30 | 60;
  setPeriod: (p: 7 | 30 | 60) => void;
}) {
  const navigate = useNavigate();

  // Period-scoped tasks — drives ENTIRE dashboard
  const periodDays = period;
  const periodTasks = useMemo(
    () => filterByDays(tasks, period === 60 ? null : period),
    [tasks, period],
  );

  // Outcome breakdown over period
  const counts = useMemo(() => {
    const c = { completed: 0, escalated: 0, corrected: 0, failed: 0 };
    for (const t of periodTasks) {
      if (t.outcome === "completed") c.completed += 1;
      else if (t.outcome === "escalated") c.escalated += 1;
      else if (t.outcome === "corrected") c.corrected += 1;
      else if (t.outcome === "failed") c.failed += 1;
    }
    return c;
  }, [periodTasks]);
  const total = periodTasks.length;
  const atcrAll = total ? (counts.completed / total) * 100 : 0;

  // Trend vs prior equivalent period
  const prevTasks = priorPeriod(tasks, periodDays);
  const prevAtcr = computeAtcr(prevTasks);
  const trendDelta = atcrAll - prevAtcr;
  const periodLabel = `vs prior ${periodDays}d`;

  // Card 1 — Accuracy
  const accDen = counts.completed + counts.corrected;
  const accuracy = accDen ? (counts.completed / accDen) * 100 : 0;
  const prevAccDen = prevTasks.filter((t) => t.outcome === "completed" || t.outcome === "corrected").length;
  const prevAccuracy = prevAccDen
    ? (prevTasks.filter((t) => t.outcome === "completed").length / prevAccDen) * 100
    : 0;

  // Card 2 — Escalation
  const escalationRate = total ? (counts.escalated / total) * 100 : 0;
  const prevEscRate = prevTasks.length
    ? (prevTasks.filter((t) => t.outcome === "escalated").length / prevTasks.length) * 100
    : 0;

  // Card 3 — Processing time (period scoped)
  const procTimes = periodTasks.map((t) => t.processing_seconds ?? 0).filter((n) => n > 0);
  const avgProc = procTimes.length ? procTimes.reduce((a, b) => a + b, 0) / procTimes.length : 0;
  const avgBaselineMin = baselines.length
    ? baselines.reduce((a, b) => a + (b.minutes_per_task ?? 0), 0) / baselines.length
    : 0;
  const speedup = avgProc > 0 && avgBaselineMin > 0 ? (avgBaselineMin * 60) / avgProc : 0;

  // Card 4 — Coaching (period scoped)
  const periodCorrections = useMemo(() => {
    if (period === 60) return corrections;
    const cutoff = Date.now() - period * 86400000;
    return corrections.filter((c) => new Date(c.created_at).getTime() >= cutoff);
  }, [corrections, period]);
  const totalCorrections = periodCorrections.length;
  const generalized = periodCorrections.filter((c) => c.generalized).length;
  const genPct = totalCorrections ? (generalized / totalCorrections) * 100 : 0;

  // Trend chart — 7-day rolling average for 30d/60d; raw for 7d.
  // Drop the trailing day (partial) to avoid misleading drop-off.
  const rollingWindow = period === 7 ? 1 : 7;
  const trendData = useMemo(() => {
    const series = dailyAtcr(periodTasks, rollingWindow);
    return series.length > 1 ? series.slice(0, -1) : series;
  }, [periodTasks, rollingWindow]);
  const showRawDots = period !== 7;
  const latestAtcr = trendData.length ? trendData[trendData.length - 1].atcr : 0;
  // Smart x-axis: aim for ~7 ticks regardless of period
  const xTickInterval = Math.max(0, Math.floor(trendData.length / 7) - 1);

  const segments = [
    {
      key: "autonomous",
      label: "Autonomous",
      color: TEAL,
      value: counts.completed,
      desc: "Tasks resolved by AI end-to-end without human intervention.",
    },
    {
      key: "corrected",
      label: "Corrected",
      color: BLUE,
      value: counts.corrected,
      desc: "AI output was verified or adjusted by a human before finalization.",
    },
    {
      key: "escalated",
      label: "Escalated",
      color: AMBER,
      value: counts.escalated,
      desc: "Complex tasks routed to a human specialist for resolution.",
    },
    {
      key: "failed",
      label: "Failed",
      color: RED,
      value: counts.failed,
      desc: "System error or task could not be processed within parameters.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header with period selector */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: GRAY_900 }}>
            ZampPulse
          </h1>
          <p className="text-sm" style={{ color: GRAY_500 }}>
            Executive performance overview
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-zinc-200 shadow-sm self-start sm:self-auto">
          {[7, 30, 60].map((d) => {
            const active = period === d;
            return (
              <button
                key={d}
                onClick={() => setPeriod(d as 7 | 30 | 60)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={
                  active
                    ? { backgroundColor: "rgba(0,201,167,0.1)", color: TEAL }
                    : { color: GRAY_500 }
                }
              >
                {d}d
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero + side metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ATCR Hero */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <div className="flex justify-between items-start">
            <div>
              <p
                className="text-[11px] font-semibold uppercase tracking-widest mb-1"
                style={{ color: "#9CA3AF" }}
              >
                Autonomous Task Completion Rate
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2
                  className="text-5xl font-bold tracking-tighter"
                  style={{ color: colorForAtcr(atcrAll) }}
                >
                  {atcrAll.toFixed(1)}%
                </h2>
                <span
                  className="text-sm font-semibold"
                  style={{ color: trendDelta >= 0 ? TEAL : RED }}
                >
                  {trendDelta >= 0 ? "▲ +" : "▼ "}
                  {trendDelta.toFixed(1)}% {periodLabel}
                </span>
              </div>
            </div>
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(0,201,167,0.08)" }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: TEAL }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
          </div>

          {/* Stacked bar + legend + hover tooltips */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <span className="text-xs font-medium" style={{ color: GRAY_500 }}>
                Outcome Distribution · {total} tasks
              </span>
              <div className="flex gap-4 flex-wrap">
                {segments.map((s) => (
                  <div key={s.key} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span
                      className="text-[10px] uppercase tracking-wide"
                      style={{ color: "#9CA3AF" }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex h-4 w-full rounded-full overflow-visible bg-zinc-100">
              {segments.map((s, idx) => {
                const pct = total ? (s.value / total) * 100 : 0;
                if (pct === 0) return null;
                const isFirst = idx === 0;
                const isLast = idx === segments.length - 1;
                return (
                  <div
                    key={s.key}
                    className="group relative h-full transition-all hover:brightness-110"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: s.color,
                      borderTopLeftRadius: isFirst ? 9999 : 0,
                      borderBottomLeftRadius: isFirst ? 9999 : 0,
                      borderTopRightRadius: isLast ? 9999 : 0,
                      borderBottomRightRadius: isLast ? 9999 : 0,
                    }}
                  >
                    <div className="hidden group-hover:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-52 flex-col bg-zinc-900 text-white p-3 rounded-lg shadow-xl text-[11px] z-50">
                      <span className="font-bold mb-1">
                        {s.label} ({pct.toFixed(1)}%)
                      </span>
                      <p className="text-zinc-400 leading-relaxed">{s.desc}</p>
                      <p className="text-zinc-300 mt-1 font-medium">
                        {s.value.toLocaleString()} tasks
                      </p>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-zinc-900" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side metric grid */}
        <div className="grid grid-cols-2 gap-4">
          <MiniMetric
            label="Accuracy"
            value={`${accuracy.toFixed(1)}%`}
            delta={`${accuracy >= prevAccuracy ? "▲" : "▼"} prior: ${prevAccuracy.toFixed(1)}%`}
            positive={accuracy >= prevAccuracy}
          />
          <MiniMetric
            label="Escalation"
            value={`${escalationRate.toFixed(1)}%`}
            delta={`${escalationRate <= prevEscRate ? "▼" : "▲"} prior: ${prevEscRate.toFixed(1)}%`}
            positive={escalationRate <= prevEscRate}
          />
          <MiniMetric
            label="Avg Processing"
            value={`${avgProc.toFixed(1)}s`}
            delta={speedup > 0 ? `${speedup.toFixed(1)}x vs manual` : "—"}
            positive
          />
          <MiniMetric
            label="Coaching Impact"
            value={`${totalCorrections}`}
            delta={`${generalized} generalized (${genPct.toFixed(0)}%)`}
            positive
          />
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold" style={{ color: GRAY_900 }}>
                ATCR Trend
              </h3>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: latestAtcr >= 90 ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.12)",
                  color: latestAtcr >= 90 ? GREEN : AMBER,
                }}
              >
                Now {latestAtcr.toFixed(1)}%
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: trendDelta >= 0 ? TEAL : RED }}
              >
                {trendDelta >= 0 ? "▲ +" : "▼ "}{Math.abs(trendDelta).toFixed(1)}pp {periodLabel}
              </span>
            </div>
            <p className="text-xs mt-1" style={{ color: GRAY_500 }}>
              {showRawDots ? "7-day rolling average" : "Daily values"} · Last {periodDays} days · Trailing partial day excluded
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-wider" style={{ color: GRAY_500 }}>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5" style={{ backgroundColor: TEAL }} />
              ATCR
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: "rgba(16,185,129,0.12)" }} />
              Goal ≥ 90%
            </div>
          </div>
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="atcrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: GRAY_500, fontSize: 11 }}
                tickFormatter={formatShortDate}
                axisLine={false}
                tickLine={false}
                interval={xTickInterval}
                minTickGap={20}
                tickMargin={8}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 20, 40, 60, 80, 100]}
                tick={{ fill: GRAY_500, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                width={44}
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceArea y1={90} y2={100} fill={GREEN} fillOpacity={0.06} />
              <ReferenceLine y={90} stroke={GREEN} strokeDasharray="4 4" strokeOpacity={0.5} />
              {showRawDots && (
                <Line
                  type="monotone"
                  dataKey="atcrRaw"
                  stroke="none"
                  dot={{ r: 2, fill: GRAY_500, fillOpacity: 0.25, stroke: "none" }}
                  activeDot={false}
                  isAnimationActive={false}
                />
              )}
              <Area
                type="monotone"
                dataKey="atcr"
                stroke={TEAL}
                strokeWidth={2.5}
                fill="url(#atcrFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent cards */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold" style={{ color: GRAY_900 }}>
            Agent Performance
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              tasks={periodTasks.filter((t) => t.agent_id === a.id)}
              allTasks={tasks.filter((t) => t.agent_id === a.id)}
              onClick={() => navigate({ to: "/agent/$agentId", params: { agentId: a.id } })}
            />
          ))}
        </div>
      </div>
      <footer className="text-xs text-gray-400 text-center py-4">
        Powered by ZampPulse v1.0 · Demo data: May–Jun 2026
      </footer>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 hover:border-[#00C9A7]/30 transition-colors">
      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
        style={{ color: "#9CA3AF" }}
      >
        {label}
      </p>
      <p className="text-xl font-bold" style={{ color: GRAY_900 }}>
        {value}
      </p>
      <p
        className="text-[10px] font-medium mt-1"
        style={{ color: positive ? TEAL : RED }}
      >
        {delta}
      </p>
    </div>
  );
}


function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow px-3 py-2 text-xs border border-gray-100">
      <div className="font-medium mb-1" style={{ color: GRAY_900 }}>
        {formatShortDate(label)}
      </div>
      <div style={{ color: GRAY_500 }}>ATCR: <span style={{ color: GRAY_900 }}>{p.atcr.toFixed(1)}%</span></div>
      <div style={{ color: GRAY_500 }}>Tasks: <span style={{ color: GRAY_900 }}>{p.tasks}</span></div>
    </div>
  );
}

function SparkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-zinc-900 text-white rounded px-2 py-1 text-[10px] shadow-lg">
      <div className="font-medium">{formatShortDate(label)}</div>
      <div>ATCR: {p.atcr.toFixed(1)}%</div>
    </div>
  );
}

function AgentCard({
  agent,
  tasks,
  allTasks,
  onClick,
}: {
  agent: Agent;
  tasks: TaskEvent[];
  allTasks: TaskEvent[];
  onClick: () => void;
}) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.outcome === "completed").length;
  const corrected = tasks.filter((t) => t.outcome === "corrected").length;
  const escalated = tasks.filter((t) => t.outcome === "escalated").length;
  const atcr = total ? (completed / total) * 100 : 0;
  const accDen = completed + corrected;
  const accuracy = accDen ? (completed / accDen) * 100 : 0;
  const escalation = total ? (escalated / total) * 100 : 0;

  // Anchor "now" to latest task date so demo data with stale dates still shows trends
  const latestTs = allTasks.length
    ? Math.max(...allTasks.map((t) => new Date(t.created_at).getTime()))
    : Date.now();
  const lastWeek = allTasks.filter(
    (t) => new Date(t.created_at).getTime() >= latestTs - 7 * 86400000,
  );
  const priorWeek = allTasks.filter((t) => {
    const ts = new Date(t.created_at).getTime();
    return ts >= latestTs - 14 * 86400000 && ts < latestTs - 7 * 86400000;
  });
  const wowDelta = computeAtcr(lastWeek) - computeAtcr(priorWeek);

  // Status dot
  const status =
    atcr >= 90 ? { color: GREEN, label: "Healthy" }
    : atcr >= 75 ? { color: AMBER, label: "Watch" }
    : { color: RED, label: "At risk" };

  // Sparkline: last 14 days relative to latest data, 7-day rolling, trim trailing partial day
  const sparkSource = allTasks.filter(
    (t) => new Date(t.created_at).getTime() >= latestTs - 14 * 86400000,
  );
  const dailyAll = dailyAtcr(sparkSource, 7);
  const daily = dailyAll.length > 1 ? dailyAll.slice(0, -1) : dailyAll;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left w-full bg-white rounded-xl shadow-sm p-5 cursor-pointer transition border border-zinc-200 hover:border-[#00C9A7] hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#00C9A7]/40"
    >
      {/* Header: icon + name + status dot */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{agent.role_icon}</span>
          <span className="text-base font-semibold truncate" style={{ color: GRAY_900 }}>
            {agent.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" title={status.label}>
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* ATCR + WoW pill */}
      <div className="flex items-baseline gap-2 mb-1">
        <div className="text-3xl font-bold" style={{ color: colorForAtcr(atcr) }}>
          {atcr.toFixed(1)}%
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: GRAY_500 }}>
          ATCR
        </span>
        {priorWeek.length > 0 && lastWeek.length > 0 && (
          <span
            className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: wowDelta >= 0 ? "rgba(0,201,167,0.12)" : "rgba(239,68,68,0.1)",
              color: wowDelta >= 0 ? TEAL : RED,
            }}
          >
            {wowDelta >= 0 ? "▲ +" : "▼ "}{Math.abs(wowDelta).toFixed(1)}pp WoW
          </span>
        )}
      </div>

      {/* Sparkline w/ caption + goal line + axis hint */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] mb-0.5" style={{ color: "#9CA3AF" }}>
          <span className="uppercase tracking-wide font-medium">ATCR · last 14 days</span>
          <span>Goal 90%</span>
        </div>
        <div style={{ width: "100%", height: 90 }}>
          <ResponsiveContainer>
            <LineChart data={daily} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <YAxis
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tick={{ fill: "#9CA3AF", fontSize: 9 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={false}
                tickLine={false}
                width={34}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#9CA3AF", fontSize: 9 }}
                tickFormatter={formatShortDate}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                ticks={daily.length ? [daily[0].date, daily[daily.length - 1].date] : []}
                tickMargin={4}
              />
              <ReferenceLine y={90} stroke={GREEN} strokeDasharray="3 3" strokeOpacity={0.4} />
              <Tooltip content={<SparkTooltip />} cursor={{ stroke: GRAY_500, strokeOpacity: 0.2 }} />
              <Line
                type="monotone"
                dataKey="atcr"
                stroke={TEAL}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3, fill: TEAL }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-zinc-50 rounded-md px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#9CA3AF" }}>
            Accuracy
          </div>
          <div className="text-sm font-bold" style={{ color: GRAY_900 }}>
            {accuracy.toFixed(0)}%
          </div>
        </div>
        <div className="bg-zinc-50 rounded-md px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#9CA3AF" }}>
            Escalation
          </div>
          <div className="text-sm font-bold" style={{ color: GRAY_900 }}>
            {escalation.toFixed(0)}%
          </div>
        </div>
        <div className="bg-zinc-50 rounded-md px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#9CA3AF" }}>
            Tasks
          </div>
          <div className="text-sm font-bold" style={{ color: GRAY_900 }}>
            {total}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: TEAL }}>
          View agent details
        </span>
        <span
          className="text-base font-bold transition-transform group-hover:translate-x-1"
          style={{ color: TEAL }}
        >
          →
        </span>
      </div>
    </button>
  );
}
