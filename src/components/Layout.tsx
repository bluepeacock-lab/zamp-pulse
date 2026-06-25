import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

const TEAL = "#00C9A7";

function NavLink({ to, label }: { to: string; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className="px-1 py-4 text-sm font-medium transition-colors"
      style={{
        color: active ? TEAL : "#6B7280",
        borderBottom: active ? `2px solid ${TEAL}` : "2px solid transparent",
      }}
      activeProps={{}}
    >
      {label}
    </Link>
  );
}

export default function Layout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F4F4F4", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link to="/dashboard" className="text-lg font-bold" style={{ color: "#1A1A1A" }}>
            🟢 Zamp Observatory
          </Link>
          <nav className="flex items-center gap-8">
            <NavLink to="/dashboard" label="Dashboard" />
            <NavLink to="/tasks" label="Tasks" />
            <NavLink to="/health" label="Health" />
          </nav>
          <span className="text-sm" style={{ color: "#6B7280" }}>demo@zamp.ai</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

export function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="bg-white shadow-sm rounded-xl p-8">
      <h1 className="text-2xl font-bold mb-2" style={{ color: "#1A1A1A" }}>{title}</h1>
      <p style={{ color: "#6B7280" }}>Coming in next prompt</p>
    </div>
  );
}
