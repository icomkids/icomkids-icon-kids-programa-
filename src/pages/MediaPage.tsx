import { useState } from "react";
import {
  Image as ImageIcon,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMedia } from "@/features/media/hooks/use-media";
import type { MediaItem, MediaUploadInput } from "@/features/media/types";

function formatDateBR(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

export default function MediaPage() {
  const { items, loading, upload, setActive, remove } = useMedia(false);

  const totals = {
    active: items.filter((i) => i.active).length,
    images: items.filter((i) => i.kind === "image").length,
    videos: items.filter((i) => i.kind === "video").length,
  };

  return (
    <div>
      <PageHeader
        title="Midia e anuncios"
        description="Imagens e videos exibidos no telao em rotacao com as criancas."
        actions={<UploadDialog onSubmit={upload} />}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Itens ativos" value={totals.active.toString()} color="#A6CD3F" />
          <Kpi label="Imagens" value={totals.images.toString()} color="#1E78DC" />
          <Kpi label="Videos" value={totals.videos.toString()} color="#7B36BF" />
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center">
            <ImageIcon className="size-8 text-muted-foreground" />
            <p className="text-base font-semibold">Sem midias cadastradas</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Use <strong>Upload de midia</strong> no topo para subir a primeira
              imagem ou video.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((m) => (
              <MediaCard
                key={m.id}
                item={m}
                onToggle={() => void setActive(m.id, !m.active)}
                onDelete={() => {
                  if (confirm(`Remover "${m.name}" e deletar o arquivo?`)) {
                    void remove(m.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MediaCard({
  item,
  onToggle,
  onDelete,
}: {
  item: MediaItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-video w-full bg-muted">
        {item.kind === "video" ? (
          <video
            src={item.public_url}
            className="size-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : (
          <img
            src={item.public_url}
            alt={item.name}
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-bold">{item.name}</p>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{
              background: item.active ? "#A6CD3F" : "#94a3b8",
              color: item.active ? "#0f172a" : "#ffffff",
            }}
          >
            {item.active ? "Ativo" : "Inativo"}
          </span>
        </div>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {item.kind === "video" ? (
            <Video className="size-3" />
          ) : (
            <ImageIcon className="size-3" />
          )}
          {item.duration_seconds}s · peso {item.display_weight}
        </p>
        {item.starts_on || item.ends_on ? (
          <p className="text-[11px] text-muted-foreground">
            {formatDateBR(item.starts_on)} → {formatDateBR(item.ends_on)}
          </p>
        ) : null}
        <div className="flex gap-1 pt-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="flex-1 text-xs"
            onClick={onToggle}
          >
            {item.active ? "Desativar" : "Reativar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs text-[#EA4D8E]"
            onClick={onDelete}
            aria-label="Remover"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="h-1.5" style={{ background: color }} />
      <div className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function UploadDialog({
  onSubmit,
}: {
  onSubmit: (input: MediaUploadInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState("8");
  const [weight, setWeight] = useState("1");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setFile(null);
    setDuration("8");
    setWeight("1");
    setStartsOn("");
    setEndsOn("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !file) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        file,
        duration_seconds: parseInt(duration, 10) || 8,
        display_weight: parseInt(weight, 10) || 1,
        starts_on: startsOn || undefined,
        ends_on: endsOn || undefined,
      });
      reset();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#F39230] text-slate-900 hover:bg-[#F39230]/90">
          <Upload className="size-4" /> Upload de midia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload de midia</DialogTitle>
          <DialogDescription>
            Imagens (jpg, png) ou videos (mp4) que rodam no telao entre as
            criancas.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="md-name">Nome</Label>
            <Input
              id="md-name"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Promo aniversario"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-file">Arquivo</Label>
            <Input
              id="md-file"
              type="file"
              accept="image/*,video/*"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <p className="text-[11px] text-muted-foreground">
                {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="md-dur">Duracao (seg)</Label>
              <Input
                id="md-dur"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-weight">Peso</Label>
              <Input
                id="md-weight"
                type="number"
                min={1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="md-start">Comeca em</Label>
              <Input
                id="md-start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="md-end">Termina em</Label>
              <Input
                id="md-end"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </div>
          </div>
          {error ? (
            <div className="rounded-md border border-[#EA4D8E] bg-[#EA4D8E]/10 px-3 py-2 text-xs text-[#EA4D8E]">
              {error}
            </div>
          ) : null}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
              disabled={submitting}
            >
              {submitting ? "Enviando..." : "Enviar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
