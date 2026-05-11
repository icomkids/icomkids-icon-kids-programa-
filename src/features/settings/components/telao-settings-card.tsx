import { useEffect, useState } from "react";
import { CheckCircle2, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetting } from "../hooks/use-setting";

export const TELAO_CHILD_SECONDS_KEY = "telao_child_seconds";
const DEFAULT_SECONDS = 8;

export function TelaoSettingsCard() {
  const { value, loading, saving, save } = useSetting<number>(
    TELAO_CHILD_SECONDS_KEY,
    DEFAULT_SECONDS
  );
  const [local, setLocal] = useState<number>(DEFAULT_SECONDS);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!loading) setLocal(Number(value) || DEFAULT_SECONDS);
  }, [loading, value]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = Math.max(2, Math.min(60, Math.round(local || DEFAULT_SECONDS)));
    await save(v);
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2500);
  };

  const dirty = local !== value;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <header className="flex items-center gap-2">
        <Tv className="size-4 text-[#7B36BF]" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          Tempo no telao
        </h2>
      </header>
      <p className="mt-2 text-xs text-muted-foreground">
        Quantos segundos cada crianca aparece no telao antes de trocar para a
        proxima ou para uma propaganda. As propagandas usam o tempo
        configurado em cada uma (na pagina Midia).
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="ts-seconds">Segundos por crianca (entre 2 e 60)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ts-seconds"
              type="number"
              min={2}
              max={60}
              value={loading ? "" : local}
              onChange={(e) =>
                setLocal(parseInt(e.target.value || "0", 10))
              }
              disabled={loading}
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">segundos</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={!dirty || saving || loading}
            className="bg-[#7B36BF] text-white hover:bg-[#7B36BF]/90"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          {savedAt ? (
            <span className="flex items-center gap-1 text-xs text-[#5a8e10]">
              <CheckCircle2 className="size-3.5" />
              Salvo
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
