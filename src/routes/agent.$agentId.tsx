import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
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

export const Route = createFileRoute("/agent/$agentId")({
  head: () => ({ meta: [{ title: "Agent · ZampPulse" }] }),
  component: AgentDetailPage,
});

const TEAL = "#00C9A7";
const GREEN = "#10B981";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const RED = "#EF4444";
const GRAY_400 = "#9CA3AF";
const GRAY_500 = "#6B7280";
const GRAY_900 = "#1A1A1A";

type Agent = {
  id: string;
  name: string;
  role_icon: string;
  status: string | null;
  client_id: string | null;
};

type TaskEvent = {
  id: string;
  agent_id: string;
  task_subtype: string;
  source_reference: string;
  ts_received: string;
  ts_started: string | null;
  ts_completed: string | null;
  outcome: string;
  confidence_score: number | null;
  processing_seconds: number | null;
  created_at: string;
};
type CorrectionEvent = {
  id: string;
  task_id: string;
  agent_id: string;
  corrected_field: string;
  before_value: string;
  after_value: string;
  corrected_at: string;
  generalized: boolean | null;
  accuracy_impact: number | null;
};
type Baseline = {
  id: string;
  agent_id: string;
  workflow_type: string;
  tasks_per_week: number;
  minutes_per_task: number;
  error_rate_pct: number;
  cost_per_error: number;
  hourly_cost: number;
  is_estimated: boolean | null;
  created_at: string;
  updated_at: string;
};

function colorForAtcr(v: number) {
  if (v > 90) return GREEN;
  if (v >= 75) return AMBER;
  return RED;
}
function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function dayKey(iso: string) {
  return iso.slice(0, 10);
}
function fmtShort(d: string) {
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function fmtFullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function atcrOf(list: TaskEvent[]) {
  if (!list.length) return 0;
  return (list.filter((t) => t.outcome === "completed").length / list.length) * 100;
}

function SkeletonCard({ h = "h-24" }: { h?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm p-5 ${h} animate-pulse`} />;
}

function AgentDetailPage() {
  const { agentId } = Route.useParams();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tasks, setTasks] = useState<TaskEvent[] | null>(null);
  const [corrections, setCorrections] = useState<CorrectionEvent[] | null>(null);
  const [baseline, setBaseline] = useState<Baseline | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setAgent(null);
    setTasks(null);
    setCorrections(null);
    setBaseline(undefined);
    (async () => {
      try {
        const [a, t, c, b] = await Promise.all([
          supabase.from("agents").select("*").eq("id", agentId).maybeSingle(),
          supabase.from("task_events").select("*").eq("agent_id", agentId),
          supabase.from("correction_events").select("*").eq("agent_id", agentId),
          supabase.from("baselines").select("*").eq("agent_id", agentId).maybeSingle(),
        ]);
        if (cancelled) return;
        if (a.error) throw a.error;
        if (t.error) throw t.error;
        if (c.error) throw c.error;
        if (b.error) throw b.error;
        setAgent((a.data as Agent | null) ?? null);
        setTasks((t.data ?? []) as TaskEvent[]);
        setCorrections((c.data ?? []) as CorrectionEvent[]);
        setBaseline((b.data as Baseline | null) ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId, reloadKey]);

  const loading = !error && (!agent || !tasks || !corrections || baseline === undefined);

  if (error) {
    return (
      <Layout>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
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
          <SkeletonCard h="h-8" />
          <SkeletonCard h="h-40" />
          <SkeletonCard h="h-32" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonCard h="h-64" /><SkeletonCard h="h-64" />
            <SkeletonCard h="h-64" /><SkeletonCard h="h-64" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!agent) {
    return (
      <Layout>
        <div className="bg-white rounded-xl shadow-sm p-8 text-center" style={{ color: GRAY_500 }}>
          Agent not found
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AgentDetailContent
        agent={agent}
        tasks={tasks!}
        corrections={corrections!}
        baseline={baseline ?? null}
        onSetup={() => setSetupOpen(true)}
        onEdit={() => setEditOpen(true)}
      />
      {setupOpen && (
        <BaselineModal
          mode="create"
          agentId={agent.id}
          clientId={agent.client_id}
          baseline={null}
          onClose={() => setSetupOpen(false)}
          onSaved={() => {
            setSetupOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {editOpen && baseline && (
        <BaselineModal
          mode="edit"
          agentId={agent.id}
          clientId={agent.client_id}
          baseline={baseline}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

    </Layout>
  );
}

function AgentDetailContent({
  agent,
  tasks,
  corrections,
  baseline,
  onSetup,
  onEdit,
}: {
  agent: Agent;
  tasks: TaskEvent[];
  corrections: CorrectionEvent[];
  baseline: Baseline | null;
  onSetup: () => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const counts = useMemo(() => {
    const c = { completed: 0, escalated: 0, corrected: 0, failed: 0 };
    for (const t of tasks) {
      if (t.outcome === "completed") c.completed += 1;
      else if (t.outcome === "escalated") c.escalated += 1;
      else if (t.outcome === "corrected") c.corrected += 1;
      else if (t.outcome === "failed") c.failed += 1;
    }
    return c;
  }, [tasks]);
  const total = tasks.length;
  const atcr = total ? (counts.completed / total) * 100 : 0;

  // May vs June delta
  const mayTasks = tasks.filter((t) => (t.ts_received || t.created_at).slice(0, 7) === "2026-05");
  const junTasks = tasks.filter((t) => (t.ts_received || t.created_at).slice(0, 7) === "2026-06");
  const mayAtcr = atcrOf(mayTasks);
  const junAtcr = atcrOf(junTasks);
  const delta = junAtcr - mayAtcr;

  // Subtype rows
  const subtypeRows = useMemo(() => {
    const map = new Map<string, TaskEvent[]>();
    for (const t of tasks) {
      const arr = map.get(t.task_subtype) ?? [];
      arr.push(t);
      map.set(t.task_subtype, arr);
    }
    return [...map.entries()]
      .map(([subtype, list]) => {
        const a = atcrOf(list);
        const corr = list.filter((t) => t.outcome === "corrected").length;
        const accDen = counts.completed + corr; // generic
        void accDen;
        const completedCount = list.filter((t) => t.outcome === "completed").length;
        const correctedCount = corr;
        const accuracy = completedCount + correctedCount
          ? (completedCount / (completedCount + correctedCount)) * 100
          : 0;
        const procs = list.map((t) => t.processing_seconds ?? 0).filter((n) => n > 0);
        const avg = procs.length ? procs.reduce((x, y) => x + y, 0) / procs.length : 0;
        return { subtype, atcr: a, total: list.length, accuracy, avg };
      })
      .sort((a, b) => a.atcr - b.atcr);
  }, [tasks, counts]);

  // Daily series
  const dailySeries = useMemo(() => {
    const map = new Map<string, { date: string; total: number; completed: number; escalated: number; corrected: number; failed: number; procSum: number; procCount: number }>();
    for (const t of tasks) {
      const k = dayKey(t.ts_received || t.created_at);
      const b = map.get(k) ?? { date: k, total: 0, completed: 0, escalated: 0, corrected: 0, failed: 0, procSum: 0, procCount: 0 };
      b.total += 1;
      if (t.outcome === "completed") b.completed += 1;
      else if (t.outcome === "escalated") b.escalated += 1;
      else if (t.outcome === "corrected") b.corrected += 1;
      else if (t.outcome === "failed") b.failed += 1;
      if (t.processing_seconds && t.processing_seconds > 0) {
        b.procSum += t.processing_seconds;
        b.procCount += 1;
      }
      map.set(k, b);
    }
    return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [tasks]);

  const correctionDays = useMemo(() => {
    const set = new Set<string>();
    for (const c of corrections) set.add(dayKey(c.corrected_at));
    return set;
  }, [corrections]);

  const correctionsByDay = useMemo(() => {
    const m = new Map<string, CorrectionEvent[]>();
    for (const c of corrections) {
      const k = dayKey(c.corrected_at);
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    }
    return m;
  }, [corrections]);

  const accuracyData = dailySeries.map((d) => {
    const den = d.completed + d.corrected;
    return {
      date: d.date,
      accuracy: den ? (d.completed / den) * 100 : 0,
      hasCorrection: correctionDays.has(d.date),
    };
  });
  const escalationData = dailySeries.map((d) => ({
    date: d.date,
    escalation: d.total ? (d.escalated / d.total) * 100 : 0,
  }));
  const procData = dailySeries.map((d) => ({
    date: d.date,
    avg: d.procCount ? d.procSum / d.procCount : 0,
    count: d.total,
  }));
  const volumeData = dailySeries.map((d) => ({
    date: d.date,
    completed: d.completed,
    escalated: d.escalated,
    corrected: d.corrected,
    failed: d.failed,
  }));

  const sortedTasks = [...tasks].sort((a, b) => (a.ts_received < b.ts_received ? 1 : -1));
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const recentTasks = sortedTasks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ROI calc
  const autonomousTasks = counts.completed;
  const hoursSaved = baseline ? (autonomousTasks * baseline.minutes_per_task) / 60 : 0;
  const costSaved = baseline ? hoursSaved * baseline.hourly_cost : 0;
  const errorsPrevented = baseline ? (autonomousTasks * baseline.error_rate_pct) / 100 : 0;
  const errorCostSaved = baseline ? errorsPrevented * baseline.cost_per_error : 0;

  return (
    <div className="space-y-4">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-sm font-medium"
        style={{ color: TEAL }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{agent.role_icon}</span>
        <h1 className="text-2xl font-bold" style={{ color: GRAY_900 }}>{agent.name}</h1>
        {agent.status === "active" && (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}
          >
            Active
          </span>
        )}
      </div>

      {/* Hero */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-xs uppercase tracking-wider mb-4" style={{ color: GRAY_500 }}>
          Autonomous Task Completion Rate
        </div>
        <div className="flex items-baseline gap-4 mb-5">
          <div className="text-5xl font-bold" style={{ color: colorForAtcr(atcr) }}>
            {atcr.toFixed(1)}%
          </div>
          {mayTasks.length > 0 && junTasks.length > 0 && (
            <div className="text-sm font-medium" style={{ color: delta >= 0 ? GREEN : RED }}>
              {delta >= 0 ? "▲" : "▼"} {delta >= 0 ? "+" : ""}
              {delta.toFixed(1)}% May→Jun
            </div>
          )}
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

      {/* ROI */}
      {baseline ? (
        <div
          className="bg-white rounded-xl shadow-sm p-6 border-l-4"
          style={{ borderColor: TEAL }}
        >
          <div className="flex items-baseline gap-2 mb-4">
            <div className="font-semibold" style={{ color: GRAY_900 }}>💰 ROI Summary</div>
            <div className="text-sm" style={{ color: GRAY_500 }}>(based on your process baseline)</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: GRAY_500 }}>Hours Saved</div>
              <div className="text-2xl font-bold mt-1" style={{ color: GRAY_900 }}>{hoursSaved.toFixed(1)} hrs</div>
              <div className="text-xs" style={{ color: GRAY_500 }}>this period</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: GRAY_500 }}>Cost Saved</div>
              <div className="text-2xl font-bold mt-1" style={{ color: GRAY_900 }}>${Math.round(costSaved).toLocaleString()}</div>
              <div className="text-xs" style={{ color: GRAY_500 }}>this period</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider" style={{ color: GRAY_500 }}>Errors Prevented</div>
              <div className="text-2xl font-bold mt-1" style={{ color: GRAY_900 }}>{errorsPrevented.toFixed(1)} errors</div>
              <div className="text-xs" style={{ color: GRAY_500 }}>(${Math.round(errorCostSaved).toLocaleString()} saved)</div>
            </div>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="text-xs" style={{ color: GRAY_400 }}>
              Calculated: {autonomousTasks} × {Number(baseline.minutes_per_task)} min ÷ 60 = hours. At ${Number(baseline.hourly_cost)}/hr. Baseline set: {fmtFullDate(baseline.created_at)}.
            </div>
            <button
              onClick={onEdit}
              className="text-xs underline shrink-0"
              style={{ color: GRAY_400 }}
            >
              Edit baseline
            </button>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-6 border"
          style={{
            background: "linear-gradient(to right, #E6FBF6, #FFFFFF)",
            borderColor: "#A7F0E0",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">📊</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1" style={{ color: GRAY_900 }}>
                See your ROI in hours and dollars
              </h3>
              <p className="text-sm mb-4" style={{ color: GRAY_500 }}>
                Tell us how your team handled this work before ZampPulse. Takes 2 minutes.
              </p>
              <button
                onClick={onSetup}
                className="rounded-lg px-4 py-2 text-white text-sm font-medium"
                style={{ backgroundColor: TEAL }}
              >
                Set Up Baseline →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtype table */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: GRAY_900 }}>Performance by Task Type</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ color: GRAY_500 }}>
                <th className="font-medium pb-2">Type</th>
                <th className="font-medium pb-2">ATCR</th>
                <th className="font-medium pb-2">Tasks</th>
                <th className="font-medium pb-2">Accuracy</th>
                <th className="font-medium pb-2">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {subtypeRows.map((r) => (
                <tr key={r.subtype} className="border-t border-gray-100">
                  <td className="py-2.5" style={{ color: GRAY_900 }}>{titleCase(r.subtype)}</td>
                  <td className="py-2.5 font-semibold" style={{ color: colorForAtcr(r.atcr) }}>
                    {r.atcr.toFixed(1)}%
                  </td>
                  <td className="py-2.5" style={{ color: GRAY_500 }}>{r.total}</td>
                  <td className="py-2.5" style={{ color: GRAY_500 }}>{r.accuracy.toFixed(1)}%</td>
                  <td className="py-2.5" style={{ color: GRAY_500 }}>{r.avg.toFixed(1)}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Accuracy Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={accuracyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CorrectionTooltip correctionsByDay={correctionsByDay} valueLabel="Accuracy" valueKey="accuracy" suffix="%" />} />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke={TEAL}
                strokeWidth={2}
                dot={(props: any) => {
                  const { cx, cy, payload, index } = props;
                  if (payload?.hasCorrection) {
                    return <circle key={`d-${index}`} cx={cx} cy={cy} r={6} fill={BLUE} stroke="white" strokeWidth={2} />;
                  }
                  return <circle key={`d-${index}`} cx={cx} cy={cy} r={0} fill="transparent" />;
                }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Escalation Rate">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={escalationData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<SimpleTooltip valueLabel="Escalation" valueKey="escalation" suffix="%" />} />
              <ReferenceLine y={8} stroke={GRAY_400} strokeDasharray="4 4" label={{ value: "Target 8%", position: "insideTopRight", fill: GRAY_500, fontSize: 11 }} />
              <Line type="monotone" dataKey="escalation" stroke={TEAL} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Processing Time">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={procData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}s`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Bar yAxisId="right" dataKey="count" fill={GRAY_500} fillOpacity={0.3} />
              <Line yAxisId="left" type="monotone" dataKey="avg" stroke={TEAL} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Volume by Outcome">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={volumeData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={fmtShort} tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: GRAY_500, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="completed" stackId="a" fill={GREEN} />
              <Bar dataKey="escalated" stackId="a" fill={AMBER} />
              <Bar dataKey="corrected" stackId="a" fill={BLUE} />
              <Bar dataKey="failed" stackId="a" fill={RED} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Recent tasks */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: GRAY_900 }}>Recent Tasks</h2>
          <button
            onClick={() => navigate({ to: "/tasks", search: { agent: agent.id } as any })}
            className="text-sm font-medium"
            style={{ color: TEAL }}
          >
            View All Tasks →
          </button>
        </div>
        <div className="divide-y divide-gray-100">
          {recentTasks.map((t) => (
            <div key={t.id} className="py-2.5 grid grid-cols-12 items-center text-sm gap-2">
              <div className="col-span-2 font-medium" style={{ color: GRAY_900 }}>{t.source_reference}</div>
              <div className="col-span-2" style={{ color: GRAY_500 }}>{titleCase(t.task_subtype)}</div>
              <div className="col-span-3" style={{ color: GRAY_500 }}>{fmtFullDate(t.ts_received)}</div>
              <div className="col-span-1" style={{ color: GRAY_500 }}>{t.processing_seconds ?? 0}s</div>
              <div className="col-span-2"><OutcomeBadge outcome={t.outcome} /></div>
              <div className="col-span-2 text-right" style={{ color: GRAY_500 }}>
                {t.confidence_score != null ? `${Math.round(Number(t.confidence_score) * 100)}%` : "—"}
              </div>
            </div>
          ))}
          {recentTasks.length === 0 && (
            <div className="text-sm py-4" style={{ color: GRAY_500 }}>No tasks yet</div>
          )}
        </div>
        {sortedTasks.length > PAGE_SIZE && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-sm">
            <div style={{ color: GRAY_500 }}>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedTasks.length)} of {sortedTasks.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-40"
                style={{ color: GRAY_900 }}
              >
                ← Prev
              </button>
              <span style={{ color: GRAY_500 }}>Page {safePage} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-md border border-gray-200 disabled:opacity-40"
                style={{ color: GRAY_900 }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-sm font-semibold mb-2" style={{ color: GRAY_900 }}>{title}</div>
      {children}
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
    completed: { bg: "#D1FAE5", fg: "#065F46", icon: "✓", label: "Autonomous" },
    escalated: { bg: "#FEF3C7", fg: "#92400E", icon: "⚠", label: "Escalated" },
    corrected: { bg: "#DBEAFE", fg: "#1E40AF", icon: "✎", label: "Corrected" },
    failed: { bg: "#FEE2E2", fg: "#991B1B", icon: "✕", label: "Failed" },
  };
  const m = map[outcome] ?? { bg: "#F3F4F6", fg: GRAY_500, icon: "•", label: outcome };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: m.bg, color: m.fg }}>
      <span>{m.icon}</span>{m.label}
    </span>
  );
}

function SimpleTooltip({ active, payload, label, valueLabel, valueKey, suffix }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.payload?.[valueKey];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <div className="font-medium mb-0.5" style={{ color: GRAY_900 }}>{fmtShort(label)}</div>
      <div style={{ color: GRAY_500 }}>{valueLabel}: <span style={{ color: GRAY_900 }}>{Number(v).toFixed(1)}{suffix}</span></div>
    </div>
  );
}

function CorrectionTooltip({ active, payload, label, correctionsByDay, valueLabel, valueKey, suffix }: any) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.payload?.[valueKey];
  const corrs: CorrectionEvent[] = correctionsByDay.get(label) ?? [];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 text-xs max-w-xs">
      <div className="font-medium mb-0.5" style={{ color: GRAY_900 }}>{fmtShort(label)}</div>
      <div style={{ color: GRAY_500 }}>{valueLabel}: <span style={{ color: GRAY_900 }}>{Number(v).toFixed(1)}{suffix}</span></div>
      {corrs.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
          <div className="font-medium" style={{ color: BLUE }}>Corrections ({corrs.length})</div>
          {corrs.slice(0, 3).map((c) => (
            <div key={c.id} style={{ color: GRAY_500 }}>
              <div><span style={{ color: GRAY_900 }}>{c.corrected_field}</span>: {c.before_value} → {c.after_value}</div>
              <div>Generalized: {c.generalized ? "✓" : "✗"}{c.accuracy_impact != null ? ` · impact ${Number(c.accuracy_impact).toFixed(1)}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Baseline modal ----------------

const FIELD_DEFS = [
  { key: "tasks_per_week", label: "Tasks per week", placeholder: "e.g., 60", hint: null, fallback: 50 },
  { key: "minutes_per_task", label: "Minutes per task", placeholder: "e.g., 15", hint: "💡 Most AP teams take 15–25 min per invoice.", fallback: 12 },
  { key: "error_rate_pct", label: "Error rate %", placeholder: "e.g., 3", hint: null, fallback: 4 },
  { key: "cost_per_error", label: "Cost per error $", placeholder: "e.g., 50", hint: null, fallback: 40 },
  { key: "hourly_cost", label: "Hourly cost $", placeholder: "e.g., 45", hint: "💡 Annual salary × 1.4 ÷ 2,080", fallback: 40 },
] as const;

type FieldKey = (typeof FIELD_DEFS)[number]["key"];

function BaselineModal({
  mode,
  agentId,
  baseline,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  agentId: string;
  baseline: Baseline | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<FieldKey, string>>(() => ({
    tasks_per_week: baseline ? String(baseline.tasks_per_week) : "",
    minutes_per_task: baseline ? String(baseline.minutes_per_task) : "",
    error_rate_pct: baseline ? String(baseline.error_rate_pct) : "",
    cost_per_error: baseline ? String(baseline.cost_per_error) : "",
    hourly_cost: baseline ? String(baseline.hourly_cost) : "",
  }));
  const [unsure, setUnsure] = useState<Record<FieldKey, boolean>>({
    tasks_per_week: false,
    minutes_per_task: false,
    error_rate_pct: false,
    cost_per_error: false,
    hourly_cost: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleUnsure(key: FieldKey, fallback: number) {
    setUnsure((u) => {
      const next = { ...u, [key]: !u[key] };
      if (next[key]) {
        setValues((v) => ({ ...v, [key]: String(fallback) }));
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const num = (k: FieldKey) => Number(values[k]);
      for (const f of FIELD_DEFS) {
        const n = num(f.key);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`Please enter a valid number for "${f.label}".`);
        }
      }
      const payload = {
        agent_id: agentId,
        workflow_type: baseline?.workflow_type ?? "default",
        tasks_per_week: num("tasks_per_week"),
        minutes_per_task: num("minutes_per_task"),
        error_rate_pct: num("error_rate_pct"),
        cost_per_error: num("cost_per_error"),
        hourly_cost: num("hourly_cost"),
        is_estimated: Object.values(unsure).some(Boolean),
        updated_at: new Date().toISOString(),
      };
      if (mode === "edit" && baseline) {
        const { error } = await supabase.from("baselines").update(payload).eq("id", baseline.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("baselines").insert(payload);
        if (error) throw error;
      }
      onSaved();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to save baseline");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: GRAY_900 }}>
            {mode === "edit" ? "Edit Process Baseline" : "Set Up Process Baseline"}
          </h2>
          {mode === "edit" && (
            <div className="rounded-lg p-3 mb-4 text-sm" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
              ⚠ Changing your baseline affects all future ROI calculations. Recommended only if your original estimates were significantly off.
            </div>
          )}
          <div className="space-y-4">
            {FIELD_DEFS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1" style={{ color: GRAY_900 }}>{f.label}</label>
                <input
                  type="number"
                  min={0}
                  value={values[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-400"
                />
                {f.hint && <div className="text-xs mt-1" style={{ color: GRAY_500 }}>{f.hint}</div>}
                <label className="inline-flex items-center gap-2 text-xs mt-1" style={{ color: GRAY_500 }}>
                  <input
                    type="checkbox"
                    checked={unsure[f.key]}
                    onChange={() => toggleUnsure(f.key, f.fallback)}
                  />
                  I'm not sure (use industry default: {f.fallback})
                </label>
              </div>
            ))}
          </div>
          {mode === "edit" && baseline && (
            <div className="text-xs mt-4" style={{ color: GRAY_500 }}>
              Last updated: {fmtFullDate(baseline.updated_at)}
            </div>
          )}
          {err && <div className="text-sm mt-3" style={{ color: RED }}>{err}</div>}
          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200"
              style={{ color: GRAY_900 }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: TEAL }}
            >
              {saving ? "Saving…" : mode === "edit" ? "Update Baseline" : "Save Baseline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
