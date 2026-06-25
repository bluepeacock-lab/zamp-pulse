import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

function NavLink({ to, label }: { to: string; label: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      className={
        "px-1 py-4 text-sm font-medium border-b-2 transition-colors duration-200 " +
        (active
          ? "text-teal-600 border-teal-500"
          : "text-gray-500 hover:text-gray-900 border-transparent")
      }
    >
      {label}
    </Link>
  );
}

export default function Layout({ children }: { children?: ReactNode }) {
  return (
    <div
      className="min-h-screen animate-in fade-in duration-200"
      style={{ backgroundColor: "#F4F4F4", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <Link
            to="/dashboard"
            className="text-base sm:text-lg font-semibold text-gray-900 truncate py-4 sm:py-0"
          >
            🟢 Zamp Observatory
          </Link>
          <nav className="flex items-center gap-4 sm:gap-8 col-span-2 order-3 sm:order-none border-t sm:border-t-0 border-gray-100 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <NavLink to="/dashboard" label="Dashboard" />
            <NavLink to="/tasks" label="Tasks" />
            <NavLink to="/health" label="Health" />
          </nav>
          <span className="hidden sm:inline text-sm text-gray-500">demo@zamp.ai</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

export function PlaceholderCard({ title }: { title: string }) {
  return (
    <div className="bg-white shadow-sm rounded-xl p-8">
      <h1 className="text-2xl font-semibold mb-2 text-gray-900">{title}</h1>
      <p className="text-gray-500">Coming in next prompt</p>
    </div>
  );
}
