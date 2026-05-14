import { NavLink } from "react-router-dom";
import {
  Banknote,
  CalendarRange,
  Coffee,
  Cog,
  ExternalLink,
  FileSignature,
  Gauge,
  GraduationCap,
  Hourglass,
  Image,
  LayoutDashboard,
  PartyPopper,
  QrCode,
  Smile,
  Star,
  Tags,
  Tv2,
  Users,
  Wrench,
} from "lucide-react";
import { Logo } from "@/components/common/logo";

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Badge "EM BREVE" pra modulos que ainda nao foram ativados. */
  pending?: boolean;
  /** Quando true, abre em nova aba em vez de navegar dentro do app.
   *  Util pro Telao, que tipicamente fica em uma TV separada. */
  external?: boolean;
}

// Ordem por uso real do parque: visao geral primeiro, operacao principal,
// financeiro, display, leads, depois operacoes especializadas, gestao e
// modulos adiados/raros no final.
const items: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/caixa", label: "Caixa", icon: Banknote },
  { to: "/telao", label: "Telao", icon: Tv2, external: true },
  { to: "/crm", label: "CRM & Leads", icon: Smile },
  { to: "/agendamento", label: "Agendamento", icon: CalendarRange },
  { to: "/pdv", label: "PDV / Lanchonete", icon: Coffee },
  { to: "/assinaturas", label: "Assinaturas", icon: Star },
  { to: "/parceiros", label: "Parceiros", icon: GraduationCap },
  { to: "/fidelidade", label: "Fidelidade", icon: PartyPopper },
  { to: "/lista-espera", label: "Lista de espera", icon: Hourglass },
  { to: "/midia", label: "Midia", icon: Image },
  { to: "/qrcode", label: "QR Check-out", icon: QrCode },
  { to: "/termo", label: "Termo digital", icon: FileSignature },
  { to: "/inventario", label: "Inventario", icon: Wrench },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/vendas", label: "Vendas online", icon: Tags, pending: true },
];

const utilityItems: Array<{ to: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { to: "/configuracoes", label: "Configuracoes", icon: Cog },
];

export function Sidebar() {
  return (
    <aside className="hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex flex-col items-center gap-1 border-b border-border px-4 pt-5 pb-4">
        <Logo height={64} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Gestao do parque
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {items.map((it) => {
          const content = (
            <>
              <it.icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{it.label}</span>
              {it.pending ? (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: "#F4B73F", color: "#0f172a" }}
                >
                  Em breve
                </span>
              ) : it.external ? (
                <ExternalLink className="size-3.5 shrink-0 opacity-60" />
              ) : null}
            </>
          );

          if (it.external) {
            return (
              <a
                key={it.to}
                href={it.to}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
                title="Abre em uma nova aba (pra arrastar pra TV)"
              >
                {content}
              </a>
            );
          }

          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#1E78DC] text-white"
                    : "text-foreground hover:bg-muted"
                }`
              }
            >
              {content}
            </NavLink>
          );
        })}
        <div className="my-2 border-t border-border" />
        {utilityItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[#1E78DC] text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`
            }
          >
            <it.icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{it.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        v0 · MVP
      </div>
    </aside>
  );
}

export function MobileNavBar() {
  return (
    <div className="flex items-center justify-center border-b border-border bg-card px-4 py-3 md:hidden">
      <Logo height={36} />
    </div>
  );
}
