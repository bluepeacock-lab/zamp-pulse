import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Code2, ChevronDown, Check } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useClient } from "@/lib/client-context";

function NavLink({
  to,
  label,
  variant = "default",
}: {
  to: string;
  label: string;
  variant?: "default" | "dev";
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to || pathname.startsWith(to + "/");
  const isDev = variant === "dev";
  const activeColor = isDev ? "text-indigo-600 border-indigo-500" : "text-teal-600 border-teal-500";
  const idleColor = isDev
    ? "text-indigo-500/80 hover:text-indigo-700 border-transparent"
    : "text-gray-500 hover:text-gray-900 border-transparent";
  return (
    <Link
      to={to}
      className={
        "inline-flex items-center gap-1.5 px-1 py-4 text-sm font-medium border-b-2 transition-colors duration-200 " +
        (active ? activeColor : idleColor)
      }
    >
      {isDev && <Code2 className="h-3.5 w-3.5" />}
      {label}
    </Link>
  );
}

function FullPageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "#F4F4F4" }}
    >
      <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-teal-500 animate-spin" />
    </div>
  );
}

export default function Layout({ children }: { children?: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
      if (!data.session) navigate({ to: "/login" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) navigate({ to: "/login" });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  if (checking) return <FullPageLoader />;
  if (!session) return <FullPageLoader />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div
      className="min-h-screen animate-in fade-in duration-200"
      style={{ backgroundColor: "#F4F4F4", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
          <div className="flex items-center gap-2 sm:gap-3 py-4 sm:py-0 min-w-0">
            <Link
              to="/dashboard"
              className="text-base sm:text-lg font-semibold text-gray-900 truncate"
            >
              🟢 ZampPulse
            </Link>
            <ClientSwitcher />
          </div>
          <nav className="flex items-center gap-4 sm:gap-8 col-span-2 order-3 sm:order-none border-t sm:border-t-0 border-gray-100 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
            <NavLink to="/dashboard" label="Dashboard" />
            <NavLink to="/tasks" label="Tasks" />
            <NavLink to="/health" label="Health" />
            <NavLink to="/docs" label="Docs" variant="dev" />
          </nav>
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1 transition-colors"
            >
              Sign Out
            </button>
          </div>
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
