import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/health")({
  head: () => ({ meta: [{ title: "Health · Zamp Observatory" }] }),
  component: HealthPage,
});

const TEAL = "#00C9A7";

type Signal = {
  id: string;
  signal_name: string;
  details: string | null;
  points: number;
  triggered: boolean;
};

const SIGNAL_META: Record<string, { icon: string; label: string; max: number }> = {
  task_volume_decline: { icon: "📊", label: "Task Volume", max: 30 },
  rising_corrections: { icon: "🔧", label: "Correction Trend", max: 20 },
  stuck_escalations: { icon: "📤", label: "Escalation Trend", max: 15 },
  engagement_drop: { icon: "👁", label: "Dashboard Engagement", max: 10 },
  report_unopened: { icon: "📧", label: "Report Status", max: 10 },
  missing_baseline: { icon: "📋", label: "Baseline Status", max: 10 },
};

const SIGNAL_ORDER = [
  "task_volume_decline",
  "rising_corrections",
  "stuck_escalations",
  "engagement_drop",
  "report_unopened",
  "missing_baseline",
];

const BANDS = [
  {
    key: "healthy",
    range: "0–15",
    min: 0,
    max: 15,
    label: "HEALTHY",
    pill: "bg-green-100 text-green-800",
    color: "#16a34a",
    action: "No intervention. Suggest expansion opportunities.",
    summary:
      "This account is in excellent shape. Both agents are improving and all operational signals are positive.",
  },
  {
    key: "monitor",
    range: "16–35",
    min: 16,
    max: 35,
    label: "MONITOR",
    pill: "bg-yellow-100 text-yellow-800",
    color: "#ca8a04",
    action: "CSM weekly review with data-specific outreach.",
    summary:
      "Some operational signals need attention. CSM should review weekly with data-specific observations.",
  },
  {
    key: "at_risk",
    range: "36–55",
    min: 36,
    max: 55,
    label: "AT RISK",
    pill: "bg-orange-100 text-orange-800",
    color: "#ea580c",
    action: "Schedule call within 48 hours. Prepare coaching plan.",
    summary:
      "Multiple warning signals detected. Schedule a call within 48 hours with a prepared coaching plan.",
  },
  {
    key: "critical",
    range: "56+",
    min: 56,
    max: Infinity,
    label: "CRITICAL",
    pill: "bg-red-100 text-red-800",
    color: "#dc2626",
    action: "CS Lead + Account Exec. Executive outreach. Offer re-onboarding.",
    summary:
      "Urgent intervention required. Escalate to CS Lead and Account Executive immediately.",
  },
];

function bandFor(score: number) {
  return BANDS.find((b) => score >= b.min && score <= b.max) ?? BANDS[0];
}

function HealthPage() {
  const [signals, setSignals] = useState<Signal[] | null>(null);

  useEffect(() => {
    supabase
      .from("health_signals")
      .select("id, signal_name, details, points, triggered")
      .then(({ data }) => setSignals((data as Signal[]) ?? []));
  }, []);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Account Health</h1>
        <p className="text-sm text-gray-500">
          Internal churn risk assessment · Updated daily
        </p>
      </div>

      {!signals ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm h-72 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm h-24 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <HealthContent signals={signals} />
      )}
    </Layout>
  );
}

function HealthContent({ signals }: { signals: Signal[] }) {
  const totalScore = signals.reduce((s, x) => s + (x.points || 0), 0);
  const band = bandFor(totalScore);
  const maxScore = 95;
  const pct = Math.min(100, (totalScore / maxScore) * 100);

  const byName = new Map(signals.map((s) => [s.signal_name, s]));

  const bandBg: Record<string, string> = {
    healthy: "bg-[#00C9A7]",
    monitor: "bg-yellow-400",
    at_risk: "bg-orange-400",
    critical: "bg-red-500",
  };
  const bandText: Record<string, string> = {
    healthy: "text-white",
    monitor: "text-yellow-900",
    at_risk: "text-orange-900",
    critical: "text-white",
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col lg:flex-row lg:flex-nowrap lg:items-center gap-6 lg:gap-8">
        {/* Score Gauge */}
        <div className="flex items-center gap-5 lg:pr-8 lg:border-r lg:border-gray-100 shrink-0">
          <CompactGauge percent={pct} color={band.color} score={totalScore} />
          <div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide ${band.pill} mb-1`}
            >
              {band.label}
            </span>
            <p className="text-sm text-gray-500 font-medium">Global Health Score</p>
          </div>
        </div>

        {/* Scoring Legend */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Scoring Legend
          </p>
          <div className="grid grid-cols-4 gap-1 h-12">
            {BANDS.map((b, i) => {
              const active = b.key === band.key;
              const rounded =
                i === 0 ? "rounded-l-md" : i === BANDS.length - 1 ? "rounded-r-md" : "";
              return (
                <div
                  key={b.key}
                  className={`${bandBg[b.key]} ${rounded} flex flex-col justify-center px-3 relative ${
                    active ? "ring-2 ring-offset-1 ring-[#00C9A7]" : ""
                  }`}
                >
                  <span className={`text-[10px] font-bold ${bandText[b.key]}`}>
                    {b.range}
                  </span>
                  <span
                    className={`text-[9px] leading-tight uppercase ${bandText[b.key]} opacity-90`}
                  >
                    {b.label}
                  </span>
                  {active && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#00C9A7]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommended Action */}
        <div className="bg-[#F4F4F4] rounded-lg p-4 flex items-center gap-4 border border-gray-200 lg:min-w-[320px] lg:max-w-[360px]">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0">
            <svg
              className="w-5 h-5"
              style={{ color: TEAL }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-tight">
              Recommended Action
            </p>
            <p className="text-sm font-medium text-gray-800 leading-snug">
              {band.action}
            </p>
          </div>
        </div>
      </div>

      {/* Summary line */}
      <p className="text-sm text-gray-600 max-w-3xl -mt-2">
        {band.summary}
        {band.key === "healthy" &&
          " Both agents show improving ATCR trends and all operational signals are green."}
      </p>

      {/* Signals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SIGNAL_ORDER.map((name) => {
          const sig = byName.get(name);
          const meta = SIGNAL_META[name];
          const points = sig?.points ?? 0;
          const triggered = sig?.triggered ?? false;
          const { iconBg, iconColor, icon } = triggered
            ? points >= 20
              ? { iconBg: "bg-red-100", iconColor: "text-red-700", icon: "✕" }
              : { iconBg: "bg-amber-100", iconColor: "text-amber-700", icon: "⚠" }
            : { iconBg: "bg-green-100", iconColor: "text-green-700", icon: "✓" };

          return (
            <div key={name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor} font-semibold`}
              >
                {icon}
              </div>
              <div className="min-w-0">
                <div className="font-semibold">
                  <span className="mr-1">{meta.icon}</span>
                  {meta.label}
                </div>
                <div className="text-sm text-gray-600">{sig?.details ?? "—"}</div>
                <div className="text-sm mt-1">
                  <span className={points > 0 ? "text-red-600" : "text-green-700"}>
                    +{points} points
                  </span>{" "}
                  <span className="text-xs text-gray-400">/ max {meta.max} pts</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactGauge({
  percent,
  color,
  score,
}: {
  percent: number;
  color: string;
  score: number;
}) {
  const size = 96;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E5E7EB" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-bold text-gray-900 leading-none">{score}</span>
      </div>
    </div>
  );
}
