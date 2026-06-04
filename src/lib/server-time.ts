import { supabase } from "@/lib/supabase";

/**
 * Sincronizacao de relogio cliente <-> servidor.
 *
 * PROBLEMA: os cronometros do painel/telao calculam o tempo restante
 * comparando `started_at` (gravado pelo servidor, correto) com
 * `new Date()` (relogio do PC do operador). Se o PC estiver com a
 * hora errada — caso real: maquina ~17h atrasada — o cronometro mostra
 * tempo totalmente errado (ex: 17h30 em vez de 30min).
 *
 * SOLUCAO: medir uma vez o offset entre o relogio local e o do servidor
 * (via RPC server_now), e aplicar esse offset em todo calculo de tempo.
 * Assim, mesmo com o PC desregulado, os cronometros ficam corretos.
 *
 * O offset e atualizado no boot e a cada 10 min (o relogio do PC pode
 * ser corrigido durante o uso, ou ter drift). Enquanto nao sincroniza
 * pela primeira vez, offset = 0 (usa hora local — degrada graciosamente).
 */

let offsetMs = 0;
let synced = false;

/** Diferenca = horaServidor - horaLocal (em ms). Some ao Date.now() local. */
export function getServerOffsetMs(): number {
  return offsetMs;
}

export function isClockSynced(): boolean {
  return synced;
}

/** Retorna o "agora" corrigido pra hora do servidor. */
export function serverNow(): Date {
  return new Date(Date.now() + offsetMs);
}

/** Mede o offset uma vez. Usa metade do RTT pra compensar latencia. */
export async function syncServerTime(): Promise<void> {
  try {
    const t0 = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("server_now");
    const t1 = Date.now();
    if (error || !data) return;

    const serverMs = new Date(data as string).getTime();
    if (Number.isNaN(serverMs)) return;

    // Estima o instante local correspondente ao retorno do servidor:
    // ponto medio entre o envio e a resposta (compensa a latencia da rede).
    const localMidpoint = t0 + (t1 - t0) / 2;
    offsetMs = serverMs - localMidpoint;
    synced = true;

    if (Math.abs(offsetMs) > 60_000) {
      // eslint-disable-next-line no-console
      console.warn(
        `[server-time] Relogio do PC esta ${Math.round(
          offsetMs / 1000
        )}s fora do servidor. Cronometros corrigidos automaticamente.`
      );
    }
  } catch {
    // mantem offset atual (0 ou ultimo medido)
  }
}

/** Inicia a sincronizacao periodica. Chamar 1x no boot do app. */
export function startServerTimeSync(): () => void {
  void syncServerTime();
  const id = window.setInterval(() => {
    void syncServerTime();
  }, 10 * 60 * 1000); // a cada 10 min
  return () => window.clearInterval(id);
}
