import { supabase } from "@/lib/supabase";
import type { MediaItem, MediaKind, MediaUploadInput } from "../types";

export interface MediaRepo {
  /** All items (owner view). */
  list(): Promise<MediaItem[]>;
  /** Active + within window — used by Telao. */
  listActiveForRotation(): Promise<MediaItem[]>;
  upload(input: MediaUploadInput): Promise<MediaItem>;
  setActive(id: string, active: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  subscribe(onChange: () => void): () => void;
}

interface MediaRow {
  id: string;
  name: string;
  kind: MediaKind;
  storage_path: string;
  duration_seconds: number;
  display_weight: number;
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  notes: string | null;
}

const SELECT =
  "id, name, kind, storage_path, duration_seconds, display_weight, active, starts_on, ends_on, notes";

const BUCKET = "media";

function publicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function rowToItem(r: MediaRow): MediaItem {
  return { ...r, public_url: publicUrl(r.storage_path) };
}

function detectKind(file: File): MediaKind {
  if (file.type.startsWith("video/")) return "video";
  return "image";
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export const supabaseMediaRepo: MediaRepo = {
  async list() {
    const { data, error } = await supabase
      .from("media_items")
      .select(SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as MediaRow[]).map(rowToItem);
  },
  async listActiveForRotation() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("media_items")
      .select(SELECT)
      .eq("active", true)
      .or(`starts_on.is.null,starts_on.lte.${today}`)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("display_weight", { ascending: false });
    if (error) throw error;
    return (data as unknown as MediaRow[]).map(rowToItem);
  },
  async upload(input) {
    const kind = detectKind(input.file);
    const extension = input.file.name.includes(".")
      ? input.file.name.split(".").pop() ?? ""
      : "";
    const filename = `${Date.now()}-${safeFilename(input.file.name)}`;
    const storagePath = `campaigns/${filename}${
      extension && !filename.endsWith(`.${extension}`) ? `.${extension}` : ""
    }`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, input.file, {
        cacheControl: "3600",
        contentType: input.file.type || undefined,
      });
    if (upErr) throw upErr;

    const { data, error } = await supabase
      .from("media_items")
      .insert({
        name: input.name,
        kind,
        storage_path: storagePath,
        duration_seconds: input.duration_seconds ?? 8,
        display_weight: input.display_weight ?? 1,
        active: true,
        starts_on: input.starts_on ?? null,
        ends_on: input.ends_on ?? null,
        notes: input.notes ?? null,
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return rowToItem(data as unknown as MediaRow);
  },
  async setActive(id, active) {
    const { error } = await supabase
      .from("media_items")
      .update({ active })
      .eq("id", id);
    if (error) throw error;
  },
  async remove(id) {
    const { data: row, error: fetchErr } = await supabase
      .from("media_items")
      .select("storage_path")
      .eq("id", id)
      .single();
    if (fetchErr) throw fetchErr;

    const { error: delErr } = await supabase
      .from("media_items")
      .delete()
      .eq("id", id);
    if (delErr) throw delErr;

    if (row?.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    }
  },
  subscribe(onChange) {
    const channel = supabase
      .channel(`media-items-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "media_items" },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export const mediaRepo: MediaRepo = supabaseMediaRepo;
