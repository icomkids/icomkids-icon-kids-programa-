import type { ReactNode } from "react";
import { usePermissions } from "@/features/auth/use-permissions";
import type { PermissionKey } from "@/features/auth/permissions";

/**
 * Componente declarativo pra esconder children com base em permissao.
 *
 * Exemplos:
 *   <Gate need="caixa.fechar"><Button>Fechar caixa</Button></Gate>
 *   <Gate needAny={["pdv.vender", "pdv.cancelar_venda"]}>...</Gate>
 *   <Gate need="caixa.fechar" fallback={<DisabledTooltip />}>...</Gate>
 *
 * Owner sempre passa. Atencao: nao confie so nisso pra seguranca —
 * a RLS no banco eh quem realmente bloqueia.
 */

interface GateProps {
  children: ReactNode;
  /** Permissao obrigatoria (1 chave). */
  need?: PermissionKey;
  /** Lista de permissoes — usuario precisa ter TODAS. */
  needAll?: PermissionKey[];
  /** Lista de permissoes — usuario precisa ter PELO MENOS 1. */
  needAny?: PermissionKey[];
  /** O que renderizar quando o usuario nao tem permissao. */
  fallback?: ReactNode;
}

export function Gate({ children, need, needAll, needAny, fallback = null }: GateProps) {
  const { can, canAll, canAny, loading } = usePermissions();

  if (loading) return null;

  let allowed = true;
  if (need && !can(need)) allowed = false;
  if (needAll && !canAll(needAll)) allowed = false;
  if (needAny && !canAny(needAny)) allowed = false;

  return allowed ? <>{children}</> : <>{fallback}</>;
}
