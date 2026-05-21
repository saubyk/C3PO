type Props = {
  size?: number;
  blinking?: boolean;
  className?: string;
};

export function C3POIcon({ size = 80, blinking = false, className }: Props) {
  const eyeClass = blinking ? "c3po-eye" : undefined;
  return (
    <svg
      viewBox="0 0 100 130"
      width={size}
      height={size * (130 / 100)}
      role="img"
      aria-label="C-3PO"
      className={className}
    >
      <path
        d="M 25 30 Q 25 10 50 10 Q 75 10 75 30 L 75 100 Q 75 115 65 115 L 35 115 Q 25 115 25 100 Z"
        fill="var(--color-gold)"
      />
      <circle cx="40" cy="50" r="9" fill="var(--color-bg)" />
      <circle cx="60" cy="50" r="9" fill="var(--color-bg)" />
      <circle
        className={eyeClass}
        cx="40"
        cy="50"
        r="5"
        fill="var(--color-eye)"
      />
      <circle
        className={eyeClass}
        cx="60"
        cy="50"
        r="5"
        fill="var(--color-eye)"
      />
      <rect x="38" y="80" width="24" height="4" fill="var(--color-bg)" />
      <rect x="42" y="88" width="16" height="2" fill="var(--color-bg)" />
      <circle cx="22" cy="65" r="3" fill="#b8941f" />
      <circle cx="78" cy="65" r="3" fill="#b8941f" />
    </svg>
  );
}
