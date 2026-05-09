export type MediaKind = "image" | "video";

export interface MediaItem {
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
  /** Public URL derived from storage_path. */
  public_url: string;
}

export interface MediaUploadInput {
  name: string;
  file: File;
  duration_seconds?: number;
  display_weight?: number;
  starts_on?: string;
  ends_on?: string;
  notes?: string;
}
