import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const MOCK_AUTH = import.meta.env.VITE_USE_MOCK_DATA === "true";

interface AuthState {
  session: Session | null;
  loading: boolean;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  isMock: boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mockEmail, setMockEmail] = useState<string | null>(
    MOCK_AUTH ? localStorage.getItem("icon-kids:mock-auth") : null
  );

  useEffect(() => {
    if (MOCK_AUTH) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn: AuthState["signIn"] = async (email, password) => {
    if (MOCK_AUTH) {
      localStorage.setItem("icon-kids:mock-auth", email);
      setMockEmail(email);
      return { error: null };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (MOCK_AUTH) {
      localStorage.removeItem("icon-kids:mock-auth");
      setMockEmail(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const value: AuthState = {
    session,
    loading,
    email: MOCK_AUTH ? mockEmail : session?.user.email ?? null,
    signIn,
    signOut,
    isMock: MOCK_AUTH,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function isAuthenticated(state: AuthState) {
  return state.isMock ? Boolean(state.email) : Boolean(state.session);
}
