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

  return (
    <div className="space-y-6">
      {/* Gauge */}
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <Gauge percent={pct} color={band.color} score={totalScore} />
        <div className="mt-4 flex justify-center">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${band.pill}`}
          >
            {band.label}
          </span>
        </div>
        <p className="text-gray-600 max-w-lg mx-auto mt-4">{band.summary}</p>
      </div>

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
            <div key={name} className="bg-white rounded-xl shadow-sm p-4 flex gap-3">
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

      {/* Scoring reference */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="font-semibold mb-4">Scoring Reference</h2>
        <div className="overflow-hidden rounded-lg border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2 font-medium">Score Range</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Recommended Action</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((b) => {
                const active = b.key === band.key;
                return (
                  <tr
                    key={b.key}
                    className={`border-t border-gray-100 ${
                      active ? "bg-[#E6FBF6]" : ""
                    }`}
                    style={active ? { borderLeft: `4px solid ${TEAL}` } : undefined}
                  >
                    <td className="px-4 py-2 font-medium">{b.range}</td>
                    <td className="px-4 py-2">{b.label[0] + b.label.slice(1).toLowerCase()}</td>
                    <td className="px-4 py-2 text-gray-700">{b.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommended action */}
      <div
        className="bg-white rounded-xl shadow-sm p-6"
        style={{ borderLeft: `4px solid ${TEAL}` }}
      >
        <div className="font-semibold mb-1">Recommended Action</div>
        <p className="text-gray-700">
          {band.action}
          {band.key === "healthy" && (
            <>
              {" "}
              Both agents show improving ATCR trends and all operational signals are
              green.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Gauge({
  percent,
  color,
  score,
}: {
  percent: number;
  color: string;
  score: number;
}) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="inline-flex relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#E5E7EB"
          strokeWidth={stroke}
          fill="none"
        />
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-bold leading-none">{score}</div>
        <div className="text-xs text-gray-500 mt-1">risk score</div>
      </div>
    </div>
  );
}
