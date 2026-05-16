import { Link } from "react-router-dom";
import { Lock, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tela amigavel mostrada quando o staff tenta acessar uma rota sem ter
 * permissao. Diferente de 404, deixa claro que existe mas falta acesso.
 */

interface Props {
  /** Nome amigavel do recurso (ex: "Caixa", "Marketing"). */
  resource?: string;
  /** Permissao tecnica que faltou (ex: "caixa.fechar"). */
  permission?: string;
}

export function AccessDenied({ resource, permission }: Props) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-[#EA4D8E]/10">
        <ShieldOff className="size-10 text-[#EA4D8E]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Acesso restrito
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Voce nao tem permissao pra acessar{" "}
          {resource ? <strong>{resource}</strong> : "este modulo"}. Se acha que
          isso eh um engano, fale com o dono do parque.
        </p>
      </div>
      {permission ? (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/40 px-3 py-1.5 text-xs">
          <Lock className="size-3 text-muted-foreground" />
          <span className="font-mono text-[11px] text-muted-foreground">
            Falta: {permission}
          </span>
        </div>
      ) : null}
      <Button asChild variant="outline" className="mt-2">
        <Link to="/painel">Voltar pro painel</Link>
      </Button>
    </div>
  );
}
