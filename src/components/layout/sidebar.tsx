import { NavLink } from "react-router-dom";
import {
  Banknote,
  CalendarRange,
  Coffee,
  Cog,
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
  module: number;
}

// Ordem por uso real do parque: visao geral primeiro, operacao principal,
// financeiro, display, leads, depois operacoes especializadas, gestao e
// modulos adiados/raros no final.
const items: Item[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge, module: 13 },
  { to: "/painel", label: "Painel", icon: LayoutDashboard, module: 1 },
  { to: "/caixa", label: "Caixa", icon: Banknote, module: 3 },
  { to: "/telao", label: "Telao", icon: Tv2, module: 2 },
  { to: "/crm", label: "CRM & Leads", icon: Smile, module: 16 },
  { to: "/agendamento", label: "Agendamento", icon: CalendarRange, module: 7 },
  { to: "/pdv", label: "PDV / Lanchonete", icon: Coffee, module: 11 },
  { to: "/assinaturas", label: "Assinaturas", icon: Star, module: 6 },
  { to: "/parceiros", label: "Parceiros", icon: GraduationCap, module: 4 },
  { to: "/fidelidade", label: "Fidelidade", icon: PartyPopper, module: 14 },
  { to: "/lista-espera", label: "Lista de espera", icon: Hourglass, module: 12 },
  { to: "/midia", label: "Midia", icon: Image, module: 8 },
  { to: "/qrcode", label: "QR Check-out", icon: QrCode, module: 9 },
  { to: "/termo", label: "Termo digital", icon: FileSignature, module: 10 },
  { to: "/inventario", label: "Inventario", icon: Wrench, module: 15 },
  { to: "/equipe", label: "Equipe", icon: Users, module: 17 },
  { to: "/vendas", label: "Vendas online", icon: Tags, module: 5 },
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
        {items.map((it) => (
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
            <it.icon className="size-4 shrink-0" />
            <span className="flex-1 truncate">{it.label}</span>
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-bold opacity-70 group-data-[active=true]:opacity-100"
              style={{ background: "rgba(0,0,0,0.06)" }}
            >
              <span className="opacity-80">M{it.module.toString().padStart(2, "0")}</span>
            </span>
          </NavLink>
        ))}
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
