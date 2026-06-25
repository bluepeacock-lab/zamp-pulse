import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";

type TasksSearch = { agent?: string };

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [{ title: "Tasks · Zamp Scan" }] }),
  validateSearch: (search: Record<string, unknown>): TasksSearch => ({
    agent: typeof search.agent === "string" ? search.agent : undefined,
  }),
  component: TasksPage,
});

const TEAL = "#00C9A7";

type Agent = { id: string; name: string; role_icon: string };
type TaskEvent = {
  id: string;
  agent_id: string;
  workflow_type: string;
  task_subtype: string;
  source_system: string;
  source_reference: string;
  ts_received: string;
  ts_started: string;
  ts_completed: string;
  ts_resolved: string | null;
  outcome: "completed" | "escalated" | "corrected" | "failed";
  confidence_score: number;
  escalation_reason: string | null;
  processing_seconds: number;
  channel?: string | null;
};
type CorrectionEvent = {
  id: string;
  task_id: string;
  agent_id: string;
  corrected_field: string;
  before_value: string;
  after_value: string;
  corrected_at: string;
  generalized: boolean;
  accuracy_impact: number | null;
};

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function fmtDuration(s: number | null) {
  if (s == null) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

const OUTCOME_META: Record<string, { label: string; icon: string; cls: string }> = {
  completed: { label: "Completed", icon: "✓", cls: "bg-green-100 text-green-800" },
  escalated: { label: "Escalated", icon: "⚠", cls: "bg-amber-100 text-amber-800" },
  corrected: { label: "Corrected", icon: "✎", cls: "bg-blue-100 text-blue-800" },
  failed: { label: "Failed", icon: "✕", cls: "bg-red-100 text-red-800" },
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const m = OUTCOME_META[outcome] ?? { label: outcome, icon: "•", cls: "bg-gray-100 text-gray-800" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>
      <span>{m.icon}</span>
      {m.label}
    </span>
  );
}

function confidenceColor(c: number) {
  const pct = c * 100;
  if (pct > 90) return "text-green-600";
  if (pct >= 70) return "text-amber-600";
  return "text-red-600";
}

type SortKey = "ts_received" | "source_reference" | "agent" | "task_subtype" | "processing_seconds" | "outcome" | "confidence_score";

function TasksPage() {
  const { agent: agentParam } = Route.useSearch();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<TaskEvent[]>([]);
  const [corrections, setCorrections] = useState<CorrectionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState("2026-05-01");
  const [dateTo, setDateTo] = useState("2026-06-25");
  const [agentId, setAgentId] = useState<string>(agentParam ?? "all");
  const [outcome, setOutcome] = useState<string>("all");
  const [subtype, setSubtype] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<SortKey>("ts_received");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setAgentId(agentParam ?? "all");
  }, [agentParam]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [a, t, c] = await Promise.all([
          supabase.from("agents").select("id,name,role_icon"),
          supabase.from("task_events").select("*"),
          supabase.from("correction_events").select("*"),
        ]);
        if (!alive) return;
        if (a.error) throw a.error;
        if (t.error) throw t.error;
        if (c.error) throw c.error;
        setAgents((a.data ?? []) as Agent[]);
        setTasks((t.data ?? []) as TaskEvent[]);
        setCorrections((c.data ?? []) as CorrectionEvent[]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const agentsById = useMemo(() => {
    const m = new Map<string, Agent>();
    agents.forEach((a) => m.set(a.id, a));
    return m;
  }, [agents]);

  const correctionsByTask = useMemo(() => {
    const m = new Map<string, CorrectionEvent[]>();
    corrections.forEach((c) => {
      const arr = m.get(c.task_id) ?? [];
      arr.push(c);
      m.set(c.task_id, arr);
    });
    return m;
  }, [corrections]);

  const subtypeOptions = useMemo(() => {
    const pool = agentId === "all" ? tasks : tasks.filter((t) => t.agent_id === agentId);
    return Array.from(new Set(pool.map((t) => t.task_subtype))).sort();
  }, [tasks, agentId]);

  useEffect(() => {
    if (subtype !== "all" && !subtypeOptions.includes(subtype)) setSubtype("all");
  }, [subtypeOptions, subtype]);

  const filtered = useMemo(() => {
    const from = new Date(dateFrom + "T00:00:00Z").getTime();
    const to = new Date(dateTo + "T23:59:59Z").getTime();
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      const ts = new Date(t.ts_received).getTime();
      if (ts < from || ts > to) return false;
      if (agentId !== "all" && t.agent_id !== agentId) return false;
      if (outcome !== "all" && t.outcome !== outcome) return false;
      if (subtype !== "all" && t.task_subtype !== subtype) return false;
      if (q && !t.source_reference.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, dateFrom, dateTo, agentId, outcome, subtype, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let av: any; let bv: any;
      if (sortKey === "agent") {
        av = agentsById.get(a.agent_id)?.name ?? "";
        bv = agentsById.get(b.agent_id)?.name ?? "";
      } else if (sortKey === "ts_received") {
        av = new Date(a.ts_received).getTime();
        bv = new Date(b.ts_received).getTime();
      } else {
        av = (a as any)[sortKey];
        bv = (b as any)[sortKey];
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, agentsById]);

  useEffect(() => { setPage(1); }, [dateFrom, dateTo, agentId, outcome, subtype, search]);

  const PAGE_SIZE = 25;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = sorted.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "ts_received" ? "desc" : "asc"); }
  }

  function exportCsv() {
    const header = ["timestamp", "source", "agent", "type", "duration", "outcome", "confidence"];
    const rows = sorted.map((t) => {
      const ag = agentsById.get(t.agent_id);
      return [
        t.ts_received,
        t.source_reference,
        ag ? `${ag.role_icon} ${ag.name}` : t.agent_id,
        titleCase(t.task_subtype),
        fmtDuration(t.processing_seconds),
        t.outcome,
        `${Math.round(t.confidence_score * 100)}%`,
      ];
    });
    const csv = ["\uFEFF", header, ...rows]
      .map((r) => (Array.isArray(r) ? r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",") : String(r)))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `zampscan-tasks-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const SortArrow = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span> : null;

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: "#1A1A1A" }}>Task Log</h1>
        <p className="text-sm text-gray-500">Inspect every task event across your agents.</p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Agent</label>
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.role_icon} {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Outcome</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">All Outcomes</option>
              <option value="completed">✓ Completed</option>
              <option value="escalated">⚠ Escalated</option>
              <option value="corrected">✎ Corrected</option>
              <option value="failed">✕ Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Subtype</label>
            <select value={subtype} onChange={(e) => setSubtype(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
              <option value="all">All Subtypes</option>
              {subtypeOptions.map((s) => (
                <option key={s} value={s}>{titleCase(s)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Source reference..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm" />
            </div>
          </div>
          <button onClick={exportCsv}
            className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 rounded-lg px-4 py-2 text-sm font-medium">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-500">
          {loading ? "Loading…" : `${sorted.length} task${sorted.length === 1 ? "" : "s"} found`}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : loading ? (
          <div className="p-8 text-center text-gray-500">Loading tasks…</div>
        ) : pageRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No tasks match the current filters.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                {([
                  ["ts_received", "Date/Time"],
                  ["source_reference", "Source"],
                  ["agent", "Agent"],
                  ["task_subtype", "Type"],
                  ["processing_seconds", "Duration"],
                  ["outcome", "Outcome"],
                  ["confidence_score", "Confidence"],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th key={k} onClick={() => toggleSort(k)}
                    className="text-left font-medium px-4 py-3 cursor-pointer select-none hover:text-gray-900">
                    {label}<SortArrow k={k} />
                  </th>
                ))}
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => {
                const ag = agentsById.get(t.agent_id);
                const isOpen = expanded === t.id;
                const corr = correctionsByTask.get(t.id) ?? [];
                return (
                  <>
                    <tr key={t.id} onClick={() => setExpanded(isOpen ? null : t.id)}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{fmtDateTime(t.ts_received)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{t.source_reference}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {ag ? `${ag.role_icon} ${ag.name}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{titleCase(t.task_subtype)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtDuration(t.processing_seconds)}</td>
                      <td className="px-4 py-3"><OutcomeBadge outcome={t.outcome} /></td>
                      <td className={`px-4 py-3 font-medium ${confidenceColor(t.confidence_score)}`}>
                        {Math.round(t.confidence_score * 100)}%
                      </td>
                      <td className="px-2 text-gray-400">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={t.id + "-x"}>
                        <td colSpan={8} className="px-4 pb-4">
                          <ExpandedPanel task={t} corrections={corr} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!loading && sorted.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <div>
              Showing {(pageSafe - 1) * PAGE_SIZE + 1}–{Math.min(pageSafe * PAGE_SIZE, sorted.length)} of {sorted.length}
            </div>
            <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
      </div>
    </Layout>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | "…")[] = [];
  const add = (p: number | "…") => pages.push(p);
  const around = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  let prev = 0;
  for (let i = 1; i <= totalPages; i++) {
    if (around.has(i)) {
      if (i - prev > 1) add("…");
      add(i);
      prev = i;
    }
  }
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        className="px-3 py-1 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
        Previous
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={i} className="px-2 text-gray-400">…</span>
        ) : (
          <button key={i} onClick={() => onChange(p)}
            className={`px-3 py-1 rounded-md border ${p === page ? "border-transparent text-white" : "border-gray-200 hover:bg-gray-50"}`}
            style={p === page ? { backgroundColor: TEAL } : undefined}>
            {p}
          </button>
        ),
      )}
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        className="px-3 py-1 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
        Next
      </button>
    </div>
  );
}

function ExpandedPanel({ task, corrections }: { task: TaskEvent; corrections: CorrectionEvent[] }) {
  const latency = Math.max(0, Math.round((new Date(task.ts_started).getTime() - new Date(task.ts_received).getTime()) / 1000));
  const duration = Math.max(0, Math.round((new Date(task.ts_completed).getTime() - new Date(task.ts_started).getTime()) / 1000));
  return (
    <div className="bg-gray-50 rounded-lg p-4 mt-1 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</h4>
        <ul className="space-y-2 text-sm">
          <li>⏰ <span className="text-gray-500">Received:</span> {fmtDateTime(task.ts_received)}</li>
          <li>▶️ <span className="text-gray-500">Started:</span> {fmtDateTime(task.ts_started)} <span className="text-gray-400">(latency: {latency}s)</span></li>
          <li>✅ <span className="text-gray-500">Completed:</span> {fmtDateTime(task.ts_completed)} <span className="text-gray-400">(duration: {duration}s)</span></li>
          {task.outcome === "escalated" && (
            <li>⚠️ <span className="text-gray-500">Escalated to human at</span> {fmtDateTime(task.ts_completed)}</li>
          )}
          {corrections.map((c) => (
            <li key={c.id}>🔄 <span className="text-gray-500">Corrected by user at</span> {fmtDateTime(c.corrected_at)}</li>
          ))}
          {task.ts_resolved && (
            <li>✓ <span className="text-gray-500">Resolved at</span> {fmtDateTime(task.ts_resolved)}</li>
          )}
        </ul>
      </div>

      {/* Task Context */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Task Context</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Task Type</dt><dd className="text-gray-900">{titleCase(task.task_subtype)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Channel</dt><dd className="text-gray-900">{task.source_system}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Source</dt><dd className="text-gray-900">{task.source_reference}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-gray-500">Confidence</dt>
            <dd className={`font-medium ${confidenceColor(task.confidence_score)}`}>{Math.round(task.confidence_score * 100)}%</dd></div>
          <div className="flex justify-between gap-3 items-center"><dt className="text-gray-500">Action Taken</dt><dd><OutcomeBadge outcome={task.outcome} /></dd></div>
          {task.escalation_reason && (
            <div className="flex justify-between gap-3"><dt className="text-gray-500">Reason</dt><dd className="text-gray-900 text-right">{task.escalation_reason}</dd></div>
          )}
        </dl>
      </div>

      {/* Corrections */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Corrections</h4>
        {task.outcome !== "corrected" || corrections.length === 0 ? (
          <p className="text-sm text-gray-500">No corrections for this task.</p>
        ) : (
          <div className="space-y-4 text-sm">
            {corrections.map((c) => (
              <div key={c.id} className="space-y-1">
                <p className="text-gray-900">
                  User changed <span className="font-medium">{c.corrected_field}</span> from{" "}
                  <span className="font-mono bg-white px-1 rounded">&quot;{c.before_value}&quot;</span> to{" "}
                  <span className="font-mono bg-white px-1 rounded">&quot;{c.after_value}&quot;</span>
                </p>
                <p className="text-gray-500">
                  Generalizable: {c.generalized ? "✓ Yes" : "✗ No"}
                </p>
                {c.generalized && (
                  <>
                    <p className="text-gray-500">→ Suggested rule: auto-apply <span className="italic">{c.corrected_field} = "{c.after_value}"</span> for similar tasks</p>
                    <button
                      className="mt-1 px-3 py-1.5 rounded-md text-white text-xs font-medium"
                      style={{ backgroundColor: TEAL }}
                      onClick={(e) => e.stopPropagation()}>
                      Approve Rule for Auto-Application
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
