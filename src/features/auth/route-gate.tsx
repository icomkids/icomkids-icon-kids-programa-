import type { ReactNode } from "react";
import { usePermissions } from "@/features/auth/use-permissions";
import type { PermissionKey } from "@/features/auth/permissions";
import { AccessDenied } from "@/features/auth/components/access-denied";

/**
 * Wrapper de rota: se o usuario nao tem nenhuma das permissoes
 * necessarias, mostra AccessDenied em vez do conteudo.
 *
 * Diferente do <Gate> simples (que esconde silenciosamente), aqui o
 * usuario fica sabendo que ha algo ali mas que falta acesso.
 *
 * Owner sempre passa.
 *
 * Uso em App.tsx:
 *   <Route path="/marketing" element={
 *     <RouteGate needAny={["marketing.ver"]} resource="Marketing">
 *       <MarketingPage />
 *     </RouteGate>
 *   } />
 */

interface Props {
  children: ReactNode;
  /** Pelo menos uma das chaves libera. */
  needAny: PermissionKey[];
  /** Nome amigavel do recurso (mostrado no AccessDenied). */
  resource?: string;
}

export function RouteGate({ children, needAny, resource }: Props) {
  const { canAny, isOwner, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-[#1E78DC] border-t-transparent" />
      </div>
    );
  }

  if (isOwner || canAny(needAny)) {
    return <>{children}</>;
  }

  return (
    <AccessDenied
      resource={resource}
      permission={needAny.length === 1 ? needAny[0] : `qualquer uma de ${needAny.length}`}
    />
  );
}
