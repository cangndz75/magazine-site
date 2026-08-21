"use client";

import { useId } from "react";

type MfaStepUpPasswordProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
};

export function MfaStepUpPassword({
  value,
  onChange,
  disabled = false,
  label = "Mevcut parola",
}: MfaStepUpPasswordProps) {
  const inputId = useId();

  return (
    <label htmlFor={inputId} className="block text-sm text-zinc-700">
      {label}
      <input
        id={inputId}
        className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        type="password"
        name="password"
        autoComplete="current-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        minLength={12}
        maxLength={128}
      />
    </label>
  );
}
