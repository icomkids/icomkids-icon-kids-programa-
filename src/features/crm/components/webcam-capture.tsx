import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Called when user captures (or re-captures) a photo. The blob is a JPEG. */
  onCapture: (blob: Blob, previewUrl: string) => void;
  /** Optional preview to show as already captured (e.g. when editing). */
  existingPreviewUrl?: string | null;
  /** Called when user clears the captured photo. */
  onClear?: () => void;
}

const PHOTO_SIZE = 480;

export function WebcamCapture({
  onCapture,
  existingPreviewUrl,
  onClear,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPreviewUrl ?? null
  );

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message.includes("Permission")
            ? "Permissao da camera negada. Habilite em ajustes do navegador."
            : e.message
          : "Nao foi possivel acessar a camera."
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE;
    canvas.height = PHOTO_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Square crop centered.
    const w = video.videoWidth;
    const h = video.videoHeight;
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) / 2;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        onCapture(blob, url);
        stop();
      },
      "image/jpeg",
      0.85
    );
  };

  const clear = () => {
    setPreviewUrl(null);
    onClear?.();
  };

  if (previewUrl) {
    return (
      <div className="space-y-2">
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Foto capturada"
            className="size-32 rounded-lg object-cover ring-2 ring-[#1E78DC]"
          />
          <button
            type="button"
            onClick={clear}
            className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-[#EA4D8E] text-white shadow"
            aria-label="Remover foto"
          >
            <X className="size-3" />
          </button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setPreviewUrl(null);
            start();
          }}
          className="text-xs"
        >
          <RotateCw className="size-3" /> Tirar outra
        </Button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="space-y-1.5">
        <Button
          type="button"
          variant="outline"
          onClick={start}
          className="border-[#1E78DC] text-[#1E78DC]"
        >
          <Camera className="size-4" /> Tirar foto da crianca
        </Button>
        {error ? (
          <p className="text-xs text-[#EA4D8E]">{error}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Opcional. Voce pode pular e cadastrar sem foto.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-square w-full max-w-xs object-cover"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={capture}
          className="bg-[#1E78DC] text-white hover:bg-[#1E78DC]/90"
        >
          <Camera className="size-4" /> Capturar
        </Button>
        <Button type="button" variant="ghost" onClick={stop}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
