interface Props {
  /** Height in pixels. Width auto-scales preserving aspect ratio. */
  height?: number;
  className?: string;
  /** When the logo sits on a non-white background, applies mix-blend-mode
   *  to drop the JPEG white halo. */
  onColoredBg?: boolean;
}

const LOGO_SRC = "/brand/icomkids-logo.jpg";

/**
 * Official iCOM Kids logo. Stored in /public/brand/. JPEG has a white
 * background; on dark/colored surfaces we use mix-blend-mode: multiply.
 */
export function Logo({ height = 40, className = "", onColoredBg = false }: Props) {
  return (
    <img
      src={LOGO_SRC}
      height={height}
      alt="iCOM Kids"
      className={className}
      style={{
        height,
        width: "auto",
        objectFit: "contain",
        mixBlendMode: onColoredBg ? "multiply" : undefined,
      }}
    />
  );
}
