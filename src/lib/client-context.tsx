import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";

export type Client = {
  id: string;
  slug: string;
  name: string;
};

type ClientContextValue = {
  loading: boolean;
  clients: Client[];
  activeClient: Client | null;
  setActiveClient: (c: Client) => void;
};

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

const STORAGE_KEY = "zp.activeClientId";

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClientState] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async (userId: string | undefined) => {
      if (!userId) {
        if (!cancelled) {
          setClients([]);
          setActiveClientState(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      const { data: uc } = await supabase
        .from("user_clients")
        .select("client_id, is_default, clients(id, slug, name)")
        .eq("user_id", userId);
      let defaultId: string | null = null;
      if (uc && uc.length) {
        for (const row of uc as any[]) {
          if (row.clients && row.is_default) defaultId = row.clients.id;
        }
      }
      const { data: all } = await supabase
        .from("clients")
        .select("id, slug, name")
        .eq("slug", "doordash");
      const list = (all ?? []) as Client[];
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      const picked =
        list.find((c) => c.id === stored) ||
        list.find((c) => c.id === defaultId) ||
        list[0] ||
        null;
      if (!cancelled) {
        setClients(list);
        setActiveClientState(picked);
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data }) => load(data.session?.user.id));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setClients([]);
        setActiveClientState(null);
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        load(session?.user.id);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const setActiveClient = useCallback((c: Client) => {
    setActiveClientState(c);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, c.id);
  }, []);

  const value = useMemo(
    () => ({ loading, clients, activeClient, setActiveClient }),
    [loading, clients, activeClient, setActiveClient],
  );

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClient() {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used within ClientProvider");
  return ctx;
}
