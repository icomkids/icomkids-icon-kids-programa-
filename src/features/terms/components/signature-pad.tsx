import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Returns a PNG data URL when the user releases the pointer. */
  onChange?: (dataUrl: string | null) => void;
  height?: number;
}

/**
 * Lightweight signature pad — pointer events on a canvas, no extra deps.
 * Stores the strokes locally and produces a PNG data-URL on demand.
 */
export function SignaturePad({ onChange, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const pointToCanvas = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const start = (e: PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    lastRef.current = pointToCanvas(e);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = pointToCanvas(e);
    const last = lastRef.current ?? p;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
    if (empty) setEmpty(false);
  };

  const stop = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    const canvas = canvasRef.current;
    if (canvas && onChange) {
      onChange(empty ? null : canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
    onChange?.(null);
  };

  return (
    <div className="space-y-2">
      <div
        className="relative overflow-hidden rounded-xl border-2 border-dashed border-border bg-white"
        style={{ height }}
      >
        <canvas
          ref={canvasRef}
          className="size-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        {empty ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Assine aqui
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={clear}
        disabled={empty}
        className="text-xs"
      >
        <Eraser className="size-3.5" /> Limpar
      </Button>
    </div>
  );
}
