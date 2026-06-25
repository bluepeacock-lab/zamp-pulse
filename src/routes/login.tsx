import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · ZampPulse" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <div
      className="min-h-screen flex flex-col px-4 py-6"
      style={{ backgroundColor: "#F4F4F4", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
          <h1 className="text-2xl font-bold text-center text-gray-900">🟢 ZampPulse</h1>
          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-medium rounded-lg py-2.5 hover:opacity-90 active:scale-[0.98] transition flex items-center justify-center disabled:opacity-70"
              style={{ backgroundColor: "#00C9A7" }}
            >
              {loading ? (
                <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
      <footer className="text-center text-sm text-gray-500 pt-4">
        ZampPulse V1. For access Contact: rakeshgorkal@gmail.com
      </footer>
    </div>
  );
}
