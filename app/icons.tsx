export type IconProps = { className?: string };

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12.01 2C6.75 2 2.49 6.26 2.49 11.52c0 1.77.48 3.44 1.4 4.9L2 22l5.71-1.86a9.46 9.46 0 0 0 4.3 1.04h.01c5.26 0 9.52-4.26 9.52-9.52C21.54 6.4 17.28 2 12.01 2Zm0 17.35h-.01a7.8 7.8 0 0 1-3.98-1.09l-.29-.17-2.84.93.93-2.77-.19-.29a7.83 7.83 0 0 1-1.2-4.14c0-4.33 3.53-7.86 7.87-7.86 2.1 0 4.07.82 5.56 2.31a7.8 7.8 0 0 1 2.3 5.56c0 4.34-3.53 7.87-7.87 7.87h-.01" />
      <path d="M16.24 13.66c-.24-.12-1.41-.7-1.63-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.92-1.18-.71-.63-1.19-1.42-1.33-1.66-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

export function GoldIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 16.5 6.8 8h10.4L19 16.5H5Z" />
      <path d="M6.6 12.2h10.8" />
    </svg>
  );
}

export function UsdIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.2" y="6.2" width="17.6" height="11.6" rx="2" />
      <circle cx="12" cy="12" r="2.9" />
      <path d="M6 9v0M18 15v0" />
    </svg>
  );
}

export function TetherIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.8" />
      <path d="M8.2 8.6h7.6M12 8.6v7" />
      <path d="M9.4 12.1h5.2" />
    </svg>
  );
}

export function EurIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.8" />
      <path d="M14.4 8.3a4.3 4.3 0 1 0 0 7.4" />
      <path d="M7.6 10.6h6M7.6 13h5.2" />
    </svg>
  );
}

/*
 * Header icon set. Same 24-unit box and 1.6 stroke as the market icons above,
 * so the header and the price rails read as one family. These replace the
 * Unicode glyphs (☎ ☰ ⌄ ×) the header used to print: those inherit whatever
 * shape the user's emoji font decides on and never match a drawn set.
 */
export function PhoneIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.3 3.5h3l1.5 3.8-1.9 1.4a11.5 11.5 0 0 0 5.4 5.4l1.4-1.9 3.8 1.5v3a1.8 1.8 0 0 1-2 1.8A15.8 15.8 0 0 1 4.5 5.5a1.8 1.8 0 0 1 1.8-2Z" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6.5 6.5 17.5 17.5" />
      <path d="M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m14 7 5 5-5 5" />
    </svg>
  );
}
