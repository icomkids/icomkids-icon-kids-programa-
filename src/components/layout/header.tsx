import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/auth-context";

interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: Props) {
  const { email, signOut, isMock } = useAuth();
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border bg-card px-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <div className="hidden items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs sm:flex">
          {isMock ? (
            <span className="rounded-full bg-[#F4B73F] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900">
              demo
            </span>
          ) : null}
          <span className="font-medium text-muted-foreground">{email ?? "—"}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signOut();
          }}
          aria-label="Sair"
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );
}
