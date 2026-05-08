interface Props {
  size?: number;
  className?: string;
}

/**
 * Placeholder Icon Kids mark — playful "iK" using brand colors.
 * Replace with the official SVG once the brand asset is delivered.
 */
export function Logo({ size = 32, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label="Icon Kids"
      className={className}
    >
      <defs>
        <linearGradient id="ik-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E90FF" />
          <stop offset="55%" stopColor="#00BCD4" />
          <stop offset="100%" stopColor="#FF1493" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#ik-bg)" />
      <circle cx="20" cy="18" r="3.5" fill="#FFD700" />
      <rect x="17.5" y="24" width="5" height="22" rx="2.5" fill="#ffffff" />
      <path
        d="M30 18 v28 M30 32 l11 -11 M30 32 l13 14"
        stroke="#FFA500"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="50" cy="48" r="3" fill="#7CFC00" />
    </svg>
  );
}
