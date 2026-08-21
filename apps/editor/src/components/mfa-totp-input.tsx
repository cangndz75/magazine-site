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
    <label htmlFor={inputId} className="block text-sm text-zinc-700">
      Authenticator kodu
      <input
        id={inputId}
        className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 text-center text-lg tracking-[0.35em] text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
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
