type IconProps = {
  className?: string;
};

export function LoginEnvelopeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" />
      <path d="M3.5 6.5 10 11l6.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoginLockIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" strokeLinecap="round" />
    </svg>
  );
}

export function LoginEyeIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M2.5 10s2.75-5 7.5-5 7.5 5 7.5 5-2.75 5-7.5 5-7.5-5-7.5-5Z"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

export function LoginEyeOffIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M3 3l14 14" strokeLinecap="round" />
      <path
        d="M7.2 7.7A4.2 4.2 0 0 0 10 14.5c1.6 0 3-.8 3.9-2M5.6 5.9C3.9 7 2.5 10 2.5 10s2.75 5 7.5 5c1 0 1.9-.2 2.7-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.3 6.3A4.2 4.2 0 0 1 14.5 10c0 .6-.1 1.1-.4 1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoginShieldIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path
        d="M10 2.5 4 5v4.8c0 3.4 2.4 6.5 6 7.7 3.6-1.2 6-4.3 6-7.7V5L10 2.5Z"
        strokeLinejoin="round"
      />
      <path d="M7.5 10 9.2 11.7 12.5 8.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoginArrowIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M4 10h11" strokeLinecap="round" />
      <path d="M11.5 6.5 15 10l-3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
