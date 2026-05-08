import { PageHeader } from "@/components/layout/header";

interface Props {
  title: string;
  module: number;
  description?: string;
  scope?: string[];
}

export default function PlaceholderPage({ title, module, description, scope }: Props) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="space-y-4 p-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#1E78DC]">
            Modulo {module.toString().padStart(2, "0")}
          </p>
          <h2 className="mt-1 text-xl font-bold">Em construcao</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta tela esta planejada no roadmap. Os endpoints e schema da fundacao ja
            cobrem partes deste modulo (RLS multi-perfil, profiles, sessoes); a UI vem
            nas proximas fases.
          </p>
          {scope && scope.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Escopo previsto
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {scope.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
