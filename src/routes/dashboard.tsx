import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Zamp Observatory" }] }),
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
  status: string; // 'completed' | 'escalated' | 'corrected' | 'failed'
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
  const completed = tasks.filter((t) => t.status === "completed").length;
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

function dailyAtcr(tasks: TaskEvent[]) {
  const buckets = new Map<string, { total: number; completed: number }>();
  for (const t of tasks) {
    const k = dayKey(t.created_at);
    const b = buckets.get(k) ?? { total: 0, completed: 0 };
    b.total += 1;
    if (t.status === "completed") b.completed += 1;
    buckets.set(k, b);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, { total, completed }]) => ({
      date,
      atcr: total ? (completed / total) * 100 : 0,
      tasks: total,
    }));
}

function SkeletonCard({ h = "h-24" }: { h?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm p-5 ${h} animate-pulse`} />;
}

function DashboardPage() {
  const [tasks, setTasks] = useState<TaskEvent[] | null>(null);
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [corrections, setCorrections] = useState<CorrectionEvent[] | null>(null);
  const [baselines, setBaselines] = useState<Baseline[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 60>(30);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setTasks(null);
    setAgents(null);
    setCorrections(null);
    setBaselines(null);
    (async () => {
      try {
        const [t, a, c, b] = await Promise.all([
          supabase.from("task_events").select("*"),
          supabase.from("agents").select("*"),
          supabase.from("correction_events").select("*"),
          supabase.from("baselines").select("*"),
        ]);
        if (cancelled) return;
        if (t.error) throw t.error;
        if (a.error) throw a.error;
        if (c.error) throw c.error;
        if (b.error) throw b.error;
        setTasks((t.data ?? []) as TaskEvent[]);
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
  }, [reloadKey]);

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

  // Period-scoped tasks for chart and trend
  const periodTasks = useMemo(
    () => filterByDays(tasks, period === 60 ? null : period),
    [tasks, period],
  );

  // ATCR breakdown over ALL tasks (hero header counts)
  const counts = useMemo(() => {
    const c = { completed: 0, escalated: 0, corrected: 0, failed: 0 };
    for (const t of tasks) {
      if (t.status === "completed") c.completed += 1;
      else if (t.status === "escalated") c.escalated += 1;
      else if (t.status === "corrected") c.corrected += 1;
      else if (t.status === "failed") c.failed += 1;
    }
    return c;
  }, [tasks]);
  const total = tasks.length;
  const atcrAll = total ? (counts.completed / total) * 100 : 0;

  // Trend vs prior period
  const periodDays = period === 60 ? 30 : period;
  const currTasks = filterByDays(tasks, periodDays);
  const prevTasks = priorPeriod(tasks, periodDays);
  const currAtcr = computeAtcr(currTasks);
  const prevAtcr = computeAtcr(prevTasks);
  const trendDelta = currAtcr - prevAtcr;

  // Card 1 — Accuracy (completed/(completed+corrected))
  const accDen = counts.completed + counts.corrected;
  const accuracy = accDen ? (counts.completed / accDen) * 100 : 0;
  const last30 = filterByDays(tasks, 30);
  const last30Counts = last30.reduce(
    (a, t) => {
      if (t.status === "completed") a.c += 1;
      else if (t.status === "corrected") a.x += 1;
      return a;
    },
    { c: 0, x: 0 },
  );
  const accuracy30 = last30Counts.c + last30Counts.x ? (last30Counts.c / (last30Counts.c + last30Counts.x)) * 100 : 0;

  // Card 2 — Escalation
  const escalationRate = total ? (counts.escalated / total) * 100 : 0;
  const esc30Den = last30.length;
  const esc30 = esc30Den ? (last30.filter((t) => t.status === "escalated").length / esc30Den) * 100 : 0;

  // Card 3 — Processing time
  const procTimes = tasks.map((t) => t.processing_seconds ?? 0).filter((n) => n > 0);
  const avgProc = procTimes.length ? procTimes.reduce((a, b) => a + b, 0) / procTimes.length : 0;
  const avgBaselineMin = baselines.length
    ? baselines.reduce((a, b) => a + (b.minutes_per_task ?? 0), 0) / baselines.length
    : 0;
  const speedup = avgProc > 0 && avgBaselineMin > 0 ? (avgBaselineMin * 60) / avgProc : 0;

  // Card 4 — Coaching
  const totalCorrections = corrections.length;
  const generalized = corrections.filter((c) => c.generalized).length;
  const genPct = totalCorrections ? (generalized / totalCorrections) * 100 : 0;

  // Trend chart
  const trendData = useMemo(() => dailyAtcr(periodTasks), [periodTasks]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="text-xs uppercase tracking-wider" style={{ color: GRAY_500 }}>
            Autonomous Task Completion Rate
          </div>
          <div className="flex gap-1">
            {[7, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d as 7 | 30 | 60)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                style={
                  period === d
                    ? { backgroundColor: TEAL, color: "white" }
                    : { backgroundColor: "#F3F4F6", color: GRAY_500 }
                }
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-baseline gap-4 mb-5">
          <div className="text-5xl font-bold" style={{ color: colorForAtcr(atcrAll) }}>
            {atcrAll.toFixed(1)}%
          </div>
          <div className="text-sm font-medium" style={{ color: trendDelta >= 0 ? GREEN : RED }}>
            {trendDelta >= 0 ? "▲" : "▼"} {trendDelta >= 0 ? "+" : ""}
            {trendDelta.toFixed(1)}% vs prior {periodDays}d
          </div>
        </div>

        <div className="flex h-3 w-full rounded-full overflow-hidden mb-2">
          {[
            { v: counts.completed, c: GREEN },
            { v: counts.escalated, c: AMBER },
            { v: counts.corrected, c: BLUE },
            { v: counts.failed, c: RED },
          ].map((s, i) => (
            <div
              key={i}
              style={{ width: `${total ? (s.v / total) * 100 : 0}%`, backgroundColor: s.c }}
            />
          ))}
        </div>
        <div className="text-sm" style={{ color: GRAY_500 }}>
          Autonomous: {counts.completed} · Escalated: {counts.escalated} · Corrected: {counts.corrected} · Failed: {counts.failed} · Total: {total}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Accuracy"
          value={`${accuracy.toFixed(1)}%`}
          sub={
            <span>
              <span style={{ color: accuracy30 >= accuracy ? GREEN : RED }}>
                {accuracy30 >= accuracy ? "▲" : "▼"}
              </span>{" "}
              avg: {accuracy30.toFixed(1)}%
            </span>
          }
        />
        <MetricCard
          label="Escalation Rate"
          value={`${escalationRate.toFixed(1)}%`}
          sub={
            <span>
              <span style={{ color: esc30 <= escalationRate ? GREEN : RED }}>
                {esc30 <= escalationRate ? "▼" : "▲"}
              </span>{" "}
              avg: {esc30.toFixed(1)}%
            </span>
          }
        />
        <MetricCard
          label="Avg Processing Time"
          value={`${avgProc.toFixed(1)}s`}
          sub={
            speedup > 0 ? (
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#CCF5EC", color: "#007F6B" }}
              >
                {speedup.toFixed(1)}x faster than manual
              </span>
            ) : null
          }
        />
        <MetricCard
          label="Coaching Impact"
          value={`${totalCorrections} corrections`}
          sub={
            <div className="w-full">
              <div className="mb-1">
                {generalized} generalized ({genPct.toFixed(0)}%)
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full" style={{ width: `${genPct}%`, backgroundColor: TEAL }} />
              </div>
            </div>
          }
        />
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-sm font-semibold mb-4" style={{ color: GRAY_900 }}>
          ATCR Trend
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="atcrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={TEAL} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: GRAY_500, fontSize: 12 }}
                tickFormatter={formatShortDate}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: GRAY_500, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<TrendTooltip />} />
              <ReferenceLine
                y={90}
                stroke="#9CA3AF"
                strokeDasharray="4 4"
                label={{ value: "90% Goal", position: "insideTopRight", fill: GRAY_500, fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="atcr"
                stroke={TEAL}
                strokeWidth={2}
                fill="url(#atcrFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Agent cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4" style={{ color: GRAY_900 }}>
          Your Agents
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              tasks={tasks.filter((t) => t.agent_id === a.id)}
              onClick={() => navigate({ to: "/agent/$agentId", params: { agentId: a.id } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="text-sm" style={{ color: GRAY_500 }}>{label}</div>
      <div className="text-2xl font-bold mt-1 mb-2" style={{ color: GRAY_900 }}>{value}</div>
      <div className="text-xs" style={{ color: GRAY_500 }}>{sub}</div>
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

function AgentCard({
  agent,
  tasks,
  onClick,
}: {
  agent: Agent;
  tasks: TaskEvent[];
  onClick: () => void;
}) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const corrected = tasks.filter((t) => t.status === "corrected").length;
  const escalated = tasks.filter((t) => t.status === "escalated").length;
  const atcr = total ? (completed / total) * 100 : 0;
  const accDen = completed + corrected;
  const accuracy = accDen ? (completed / accDen) * 100 : 0;
  const escalation = total ? (escalated / total) * 100 : 0;

  // May vs June ATCR (current year)
  const mayTasks = tasks.filter((t) => new Date(t.created_at).getUTCMonth() === 4);
  const juneTasks = tasks.filter((t) => new Date(t.created_at).getUTCMonth() === 5);
  const mayAtcr = computeAtcr(mayTasks);
  const juneAtcr = computeAtcr(juneTasks);
  const improving = juneAtcr > mayAtcr && juneTasks.length > 0 && mayTasks.length > 0;

  // Sparkline: last 30 days
  const daily = dailyAtcr(filterByDays(tasks, 30));

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm p-5 cursor-pointer hover:shadow-md transition border border-transparent hover:border-teal-200"
      style={{ borderColor: undefined }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{agent.role_icon}</span>
          <span className="text-lg font-semibold" style={{ color: GRAY_900 }}>{agent.name}</span>
        </div>
        {improving && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: "#D1FAE5", color: "#047857" }}
          >
            ▲ improving
          </span>
        )}
      </div>
      <div className="text-3xl font-bold mb-2" style={{ color: colorForAtcr(atcr) }}>
        {atcr.toFixed(1)}%
      </div>
      <div style={{ width: "100%", height: 60 }}>
        <ResponsiveContainer>
          <LineChart data={daily} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="atcr" stroke={TEAL} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="text-sm mt-2" style={{ color: GRAY_500 }}>
        Accuracy: {accuracy.toFixed(0)}% · Escalation: {escalation.toFixed(0)}% · Tasks: {total}
      </div>
    </div>
  );
}
