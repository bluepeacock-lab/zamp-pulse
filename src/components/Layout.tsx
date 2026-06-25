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

function ClientSwitcher() {
  const { clients, activeClient, setActiveClient, loading } = useClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (loading) {
    return <div className="h-7 w-24 rounded-md bg-gray-100 animate-pulse" />;
  }
  if (!activeClient) return null;

  const single = clients.length <= 1;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !single && setOpen((v) => !v)}
        disabled={single}
        className={
          "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm font-medium text-gray-800 transition-colors " +
          (single ? "cursor-default" : "hover:bg-gray-100 hover:border-gray-300")
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        <span className="truncate max-w-[120px]">{activeClient.name}</span>
        {!single && <ChevronDown className="h-3.5 w-3.5 text-gray-500" />}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-56 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
          <div className="px-3 py-1.5 text-xs uppercase tracking-wide text-gray-400">
            Switch client
          </div>
          {clients.map((c) => {
            const active = c.id === activeClient.id;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveClient(c);
                  setOpen(false);
                }}
                className={
                  "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors " +
                  (active ? "text-teal-700 bg-teal-50" : "text-gray-700 hover:bg-gray-50")
                }
              >
                <span>{c.name}</span>
                {active && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
