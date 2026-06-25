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
    (async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        if (!cancelled) {
          setClients([]);
          setActiveClientState(null);
          setLoading(false);
        }
        return;
      }

      // Fetch user's clients via join. Fall back to all clients if join empty.
      const { data: uc } = await supabase
        .from("user_clients")
        .select("client_id, is_default, clients(id, slug, name)")
        .eq("user_id", userId);

      let list: Client[] = [];
      let defaultId: string | null = null;
      if (uc && uc.length) {
        for (const row of uc as any[]) {
          if (row.clients) {
            list.push(row.clients as Client);
            if (row.is_default) defaultId = row.clients.id;
          }
        }
      }
      if (!list.length) {
        const { data: all } = await supabase
          .from("clients")
          .select("id, slug, name")
          .order("name");
        list = (all ?? []) as Client[];
      }

      list.sort((a, b) => a.name.localeCompare(b.name));

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
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setClients([]);
        setActiveClientState(null);
        if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
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
