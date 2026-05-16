import { NavLink } from "react-router-dom";
import {
  Banknote,
  BookOpen,
  CalendarRange,
  ClipboardList,
  Coffee,
  Cog,
  ExternalLink,
  FileSignature,
  Gauge,
  GraduationCap,
  Hourglass,
  Image,
  LayoutDashboard,
  Megaphone,
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
import { usePermissions } from "@/features/auth/use-permissions";
import type { PermissionKey } from "@/features/auth/permissions";

interface Item {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Badge "EM BREVE" pra modulos que ainda nao foram ativados. */
  pending?: boolean;
  /** Quando true, abre em nova aba em vez de navegar dentro do app.
   *  Util pro Telao, que tipicamente fica em uma TV separada. */
  external?: boolean;
  /** Permissoes que liberam o acesso. Se omitido, todos veem. Owner sempre ve. */
  needAny?: PermissionKey[];
}

// Ordem por uso real do parque: visao geral primeiro, operacao principal,
// financeiro, display, leads, depois operacoes especializadas, gestao e
// modulos adiados/raros no final.
const items: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge, needAny: ["dashboard.ver"] },
  { to: "/painel", label: "Painel", icon: LayoutDashboard, needAny: ["painel.ver"] },
  { to: "/caixa", label: "Caixa", icon: Banknote, needAny: ["caixa.ver_dia", "caixa.ver_semana", "caixa.ver_mes"] },
  { to: "/telao", label: "Telao", icon: Tv2, external: true },
  { to: "/historico", label: "Historico de criancas", icon: ClipboardList, needAny: ["historico.ver"] },
  { to: "/crm", label: "Feedback (NPS)", icon: Smile, needAny: ["crm_nps.ver"] },
  { to: "/marketing", label: "Marketing", icon: Megaphone, needAny: ["marketing.ver"] },
  { to: "/agendamento", label: "Agendamento", icon: CalendarRange, needAny: ["agendamento.ver"] },
  { to: "/pdv", label: "PDV / Lanchonete", icon: Coffee, needAny: ["pdv.ver"] },
  { to: "/assinaturas", label: "Assinaturas", icon: Star, needAny: ["assinaturas.ver"] },
  { to: "/parceiros", label: "Parceiros", icon: GraduationCap, needAny: ["parceiros.ver"] },
  { to: "/fidelidade", label: "Fidelidade", icon: PartyPopper, needAny: ["fidelidade.ver"] },
  { to: "/lista-espera", label: "Lista de espera", icon: Hourglass, needAny: ["lista_espera.ver"] },
  { to: "/midia", label: "Midia", icon: Image, needAny: ["midia.ver"] },
  { to: "/qrcode", label: "QR Check-out", icon: QrCode, needAny: ["qr_checkout.ver"] },
  { to: "/termo", label: "Termo digital", icon: FileSignature, needAny: ["termo.ver"] },
  { to: "/inventario", label: "Inventario", icon: Wrench, needAny: ["inventario.ver"] },
  { to: "/equipe", label: "Equipe", icon: Users, needAny: ["equipe.ver"] },
  { to: "/vendas", label: "Vendas online", icon: Tags, pending: true },
];

interface UtilityItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  needAny?: PermissionKey[];
}

const utilityItems: UtilityItem[] = [
  { to: "/tutorial", label: "Tutorial", icon: BookOpen, needAny: ["tutorial.ver"] },
  { to: "/configuracoes", label: "Configuracoes", icon: Cog, needAny: ["configuracoes.ver"] },
];

export function Sidebar() {
  const { canAny, isOwner, loading } = usePermissions();

  // Filtra items pelo que o usuario pode ver. Owner ve tudo.
  // Itens sem needAny (ex: Telao, Vendas pending) ficam pra todos.
  const visibleItems = items.filter((it) => {
    if (loading) return true; // mostra tudo enquanto carrega pra evitar flicker
    if (isOwner) return true;
    if (!it.needAny) return true;
    return canAny(it.needAny);
  });

  const visibleUtility = utilityItems.filter((it) => {
    if (loading) return true;
    if (isOwner) return true;
    if (!it.needAny) return true;
    return canAny(it.needAny);
  });

  return (
    <aside className="hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex flex-col items-center gap-1 border-b border-border px-4 pt-5 pb-4">
        <Logo height={64} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Gestao do parque
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {visibleItems.map((it) => {
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
        {visibleUtility.map((it) => (
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
