import { supabase } from "@/lib/supabase";

const BUCKET = "child-photos";

/**
 * Uploads a child photo blob to the public `child-photos` bucket and returns
 * its public URL. Filename is auto-generated.
 */
export async function uploadChildPhoto(blob: Blob): Promise<string> {
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
