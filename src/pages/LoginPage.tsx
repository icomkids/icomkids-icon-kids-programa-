import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAuthenticated, useAuth } from "@/features/auth/auth-context";
import { Logo } from "@/components/common/logo";

export default function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/painel";

  const [email, setEmail] = useState(auth.isMock ? "dono@iconkids.local" : "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.loading && isAuthenticated(auth)) {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await auth.signIn(email, password);
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <div
      className="flex min-h-svh items-center justify-center px-4"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(30,144,255,0.18), transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,20,147,0.18), transparent 50%), radial-gradient(circle at 50% 100%, rgba(255,215,0,0.18), transparent 50%)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo height={96} />
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            Sistema de gestao do parque
          </p>
        </div>

        {auth.isMock ? (
          <div className="mb-4 rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-3 py-2 text-xs text-slate-800">
            <strong>Modo demo:</strong> qualquer email/senha entra. Aplique a migration do Supabase
            para ativar o login real.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              required={!auth.isMock}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="text-sm font-medium text-[#EA4D8E]">{error}</p>
          ) : null}
          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
