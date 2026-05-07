import { Button } from "@/components/ui/button";

const brandSwatches = [
  { name: "Azul Principal", hex: "#1E90FF", role: "Texto, ícones, destaque (iCOM, K)" },
  { name: "Laranja", hex: "#FFA500", role: "Botões, destaque (I)" },
  { name: "Rosa Choque", hex: "#FF1493", role: "Interação, alertas (D, coração)" },
  { name: "Verde Limão", hex: "#7CFC00", role: "Sucesso (S)" },
  { name: "Azul Claro", hex: "#00BCD4", role: "Detalhes (estrela, pontos)" },
  { name: "Amarelo", hex: "#FFD700", role: "Detalhes, raios" },
  { name: "Roxo", hex: "#8A2BE2", role: "Linhas decorativas, contraste" },
];

const setupStatus = [
  { label: "Vite + React + TypeScript", status: "ok" as const },
  { label: "Tailwind v4 + paleta da marca", status: "ok" as const },
  { label: "shadcn/ui", status: "ok" as const },
  { label: "GitHub (icomkids)", status: "ok" as const },
  { label: "Supabase (cliente + .env)", status: "pending" as const },
  { label: "Schema do CRM (Módulo 1)", status: "pending" as const },
];

function StatusBadge({ status }: { status: "ok" | "pending" | "warn" }) {
  const map = {
    ok: { label: "Pronto", color: "#7CFC00", text: "#0f172a" },
    pending: { label: "Pendente", color: "#FFD700", text: "#0f172a" },
    warn: { label: "Atenção", color: "#FF1493", text: "#ffffff" },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.color, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function App() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header
        className="border-b border-border"
        style={{
          backgroundImage:
            "linear-gradient(135deg, #1E90FF 0%, #00BCD4 35%, #FF1493 100%)",
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-10 text-white">
          <p className="text-sm font-semibold uppercase tracking-widest opacity-90">
            Icon Kids
          </p>
          <h1 className="mt-2 text-4xl font-bold sm:text-5xl">
            Sistema de gestão do parque
          </h1>
          <p className="mt-3 max-w-2xl text-base opacity-95">
            CRM, telão, caixa, parceiros, assinaturas, eventos, mídia, segurança,
            PDV, lista de espera, dashboard, fidelidade, inventário, NPS e equipe
            — em um único painel.
          </p>
          <div className="mt-6 flex gap-3">
            <Button className="bg-white text-[#1E90FF] hover:bg-white/90">
              Abrir CRM
            </Button>
            <Button
              variant="outline"
              className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Documentação
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <section>
          <h2 className="text-2xl font-bold">Setup do projeto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Status das fundações antes de iniciar o Módulo 1 (CRM Simples).
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {setupStatus.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <span className="text-sm font-medium">{item.label}</span>
                <StatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Paleta da marca</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Toda interface deve usar rigorosamente estas cores.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {brandSwatches.map((c) => (
              <li
                key={c.hex}
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <div className="h-20 w-full" style={{ background: c.hex }} />
                <div className="px-4 py-3">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {c.hex}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{c.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold">Próximos passos</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
            <li>Conectar cliente Supabase via <code>.env.local</code></li>
            <li>Aplicar migration do schema do CRM (crianças, sessões, responsáveis) com RLS</li>
            <li>Implementar painel ativo de crianças com timer em tempo real</li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground">
          Icon Kids · build inicial
        </div>
      </footer>
    </div>
  );
}

export default App;
