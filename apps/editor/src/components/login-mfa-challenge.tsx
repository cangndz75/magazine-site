"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { LoginBrandHeader } from "@/components/login-brand-header";
import { LoginArrowIcon } from "@/components/login-icons";
import { MfaTotpInput } from "@/components/mfa-totp-input";
import { verifyMfaLoginChallenge } from "@/lib/auth/mfa-client";
import {
  normalizeClientRecoveryInput,
  normalizeClientTotpInput,
  presentMfaLoginFailure,
} from "@/lib/auth/mfa-presentation";

type LoginMfaMode = "totp" | "recovery";

type LoginMfaChallengeProps = {
  returnTo: string;
};

const recoveryInputClassName =
  "mt-2 block h-[50px] w-full rounded-md border border-zinc-200 bg-white px-3 font-mono text-[0.9375rem] uppercase text-zinc-950 focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20";

const primaryButtonClassName =
  "flex h-[50px] w-full items-center justify-center gap-2 rounded-md bg-brand-magenta text-sm font-semibold text-white transition-colors hover:bg-brand-magenta-hover focus:outline-none focus:ring-2 focus:ring-brand-magenta/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-400";

const secondaryButtonClassName =
  "w-full text-sm font-medium text-zinc-600 underline underline-offset-2 transition-colors hover:text-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20 disabled:cursor-not-allowed disabled:text-zinc-400";

export function LoginMfaChallenge({ returnTo }: LoginMfaChallengeProps) {
  const errorId = useId();
  const [mode, setMode] = useState<LoginMfaMode>("totp");
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverToPasswordLogin, setRecoverToPasswordLogin] = useState(false);

  async function submit() {
    if (busy) {
      return;
    }

    setError(null);
    setRecoverToPasswordLogin(false);

    if (mode === "totp") {
      const normalized = normalizeClientTotpInput(totpCode);
      if (!normalized) {
        setError("Altı haneli authenticator kodunu girin.");
        return;
      }
      setBusy(true);
      const result = await verifyMfaLoginChallenge({
        totpCode: normalized,
        returnTo,
      });
      setBusy(false);
      if (!result.ok) {
        const presentation = presentMfaLoginFailure(result.code);
        setError(presentation.message);
        setRecoverToPasswordLogin(presentation.recoverToPasswordLogin);
        return;
      }
      window.location.assign(result.returnTo);
      return;
    }

    const normalizedRecovery = normalizeClientRecoveryInput(recoveryCode);
    if (!normalizedRecovery) {
      setError("Geçerli bir kurtarma kodu girin (ör. ABCD-EFGH).");
      return;
    }
    setBusy(true);
    const result = await verifyMfaLoginChallenge({
      recoveryCode: normalizedRecovery,
      returnTo,
    });
    setBusy(false);
    if (!result.ok) {
      const presentation = presentMfaLoginFailure(result.code);
      setError(presentation.message);
      setRecoverToPasswordLogin(presentation.recoverToPasswordLogin);
      return;
    }
    window.location.assign(result.returnTo);
  }

  return (
    <div className="w-full">
      <LoginBrandHeader />

      <h1 className="mt-8 text-center font-serif text-[2.125rem] font-medium leading-tight tracking-tight text-zinc-950 sm:text-[2.375rem]">
        Doğrulama Gerekli
      </h1>
      <p className="mx-auto mt-3 max-w-[20rem] text-center text-sm leading-relaxed text-zinc-500">
        Parolanız doğrulandı. Oturumu tamamlamak için iki adımlı doğrulama
        kodunu girin.
      </p>

      {error ? (
        <div className="mt-5 space-y-3">
          <p
            id={errorId}
            className="text-center text-sm text-red-800/90"
            role="alert"
          >
            {error}
          </p>
          {recoverToPasswordLogin ? (
            <div className="text-center">
              <Link
                href="/login"
                className="text-sm font-medium text-brand-magenta underline underline-offset-2 hover:text-brand-magenta-hover"
              >
                Parola ile yeniden giriş yap
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "totp" ? (
        <div className="mt-8 space-y-4">
          <MfaTotpInput
            value={totpCode}
            onChange={setTotpCode}
            disabled={busy}
            autoFocus
            describedBy={error ? errorId : undefined}
            onEnter={() => void submit()}
          />
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Doğrulanıyor…" : "Doğrula ve devam et"}
            {!busy ? <LoginArrowIcon className="h-4 w-4" /> : null}
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => {
              setMode("recovery");
              setError(null);
              setRecoverToPasswordLogin(false);
            }}
          >
            Kurtarma kodu kullan
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <p className="text-center text-sm leading-relaxed text-zinc-500">
            Kurtarma kodları tek kullanımlıktır. Kullandıktan sonra geçersiz
            olur.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-700">
            Kurtarma kodu
            <input
              className={recoveryInputClassName}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              disabled={busy}
              aria-describedby={error ? errorId : undefined}
              required
            />
          </label>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Doğrulanıyor…" : "Kurtarma kodu ile devam et"}
            {!busy ? <LoginArrowIcon className="h-4 w-4" /> : null}
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => {
              setMode("totp");
              setError(null);
              setRecoverToPasswordLogin(false);
            }}
          >
            Authenticator koduna dön
          </button>
        </div>
      )}

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link
          href="/login"
          className="font-medium text-brand-magenta underline underline-offset-2 hover:text-brand-magenta-hover"
        >
          Parola girişine dön
        </Link>
      </p>
    </div>
  );
}
