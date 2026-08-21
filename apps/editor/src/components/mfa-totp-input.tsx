"use client";

import { useId, type KeyboardEvent } from "react";

type MfaTotpInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
  onEnter?: () => void;
};

export function MfaTotpInput({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  describedBy,
  onEnter,
}: MfaTotpInputProps) {
  const inputId = useId();

  function handleChange(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, 6);
    onChange(digits);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && onEnter) {
      event.preventDefault();
      onEnter();
    }
  }

  return (
    <label
      htmlFor={inputId}
      className="block text-xs font-semibold uppercase tracking-wide text-zinc-700"
    >
      Authenticator kodu
      <input
        id={inputId}
        className="mt-2 block h-[50px] w-full rounded-md border border-zinc-200 bg-white px-3 text-center text-lg tracking-[0.35em] text-zinc-950 focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        aria-invalid={value.length > 0 && value.length < 6 ? true : undefined}
        required
      />
    </label>
  );
}
