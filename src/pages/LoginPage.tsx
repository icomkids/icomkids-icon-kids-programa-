import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isAuthenticated, useAuth } from "@/features/auth/auth-context";
import { Logo } from "@/components/common/logo";

type Mode = "login" | "signup";

export default function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from
      ?.pathname ?? "/painel";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(auth.isMock ? "dono@iconkids.local" : "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!auth.loading && isAuthenticated(auth)) {
    return <Navigate to={from} replace />;
  }

  const reset = () => {
    setError(null);
    setInfo(null);
  };

  const handleModeSwitch = (next: Mode) => {
    setMode(next);
    reset();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (mode === "signup") {
      if (!fullName.trim()) {
        setError("Informe seu nome.");
        return;
      }
      if (password.length < 6) {
        setError("A senha precisa ter no minimo 6 caracteres.");
        return;
      }
      if (password !== passwordConfirm) {
        setError("As senhas nao conferem.");
        return;
      }
    }
    setSubmitting(true);
    if (mode === "login") {
      const { error: err } = await auth.signIn(email, password);
      setSubmitting(false);
      if (err) setError(err);
    } else {
      const { error: err, needsConfirmation } = await auth.signUp(
        email,
        password,
        fullName.trim()
      );
      setSubmitting(false);
      if (err) {
        setError(err);
        return;
      }
      if (needsConfirmation) {
        setInfo(
          "Conta criada! Verifique seu email pra confirmar antes de entrar."
        );
        setMode("login");
        setPassword("");
        setPasswordConfirm("");
        setFullName("");
      }
      // se nao precisa confirmar, o supabase ja vai logar automaticamente
      // via onAuthStateChange e o redirect acontece via Navigate acima
    }
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

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => handleModeSwitch("login")}
            className={`rounded-md px-3 py-2 transition ${
              mode === "login"
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch("signup")}
            className={`rounded-md px-3 py-2 transition ${
              mode === "signup"
                ? "bg-card text-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Criar conta
          </button>
        </div>

        {auth.isMock ? (
          <div className="mb-4 rounded-md border border-[#F4B73F] bg-[#F4B73F]/15 px-3 py-2 text-xs text-slate-800">
            <strong>Modo demo:</strong> qualquer email/senha entra. Aplique a
            migration do Supabase para ativar o login real.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Nome completo</Label>
              <Input
                id="full-name"
                type="text"
                required
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          ) : null}

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
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "signup" ? (
              <p className="text-[11px] text-muted-foreground">
                Minimo 6 caracteres.
              </p>
            ) : null}
          </div>

          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="password-confirm">Confirmar senha</Label>
              <Input
                id="password-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </div>
          ) : null}

          {error ? (
            <p className="text-sm font-medium text-[#EA4D8E]">{error}</p>
          ) : null}
          {info ? (
            <div className="rounded-md border border-[#A6CD3F] bg-[#A6CD3F]/10 px-3 py-2 text-xs text-slate-800">
              {info}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
          >
            {submitting
              ? mode === "login"
                ? "Entrando..."
                : "Criando conta..."
              : mode === "login"
              ? "Entrar"
              : "Criar conta"}
          </Button>
        </form>

        {mode === "signup" ? (
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Ao criar conta voce aceita ser um cliente do parque. O acesso de
            funcionario e proprietario e ativado manualmente pelo dono.
          </p>
        ) : null}
      </div>
    </div>
  );
}
