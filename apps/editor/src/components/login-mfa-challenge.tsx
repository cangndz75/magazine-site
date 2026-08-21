"use client";

import Link from "next/link";
import { useId, useState } from "react";
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
    <div className="w-full max-w-sm px-6">
      <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
        Magazin Editor
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
        Doğrulama gerekli
      </h1>
      <p className="mt-3 text-sm text-zinc-600">
        Parolanız doğrulandı. Oturumu tamamlamak için iki adımlı doğrulama kodunu girin.
      </p>

      {error ? (
        <div className="mt-4 space-y-3">
          <p id={errorId} className="text-sm text-zinc-800" role="alert">
            {error}
          </p>
          {recoverToPasswordLogin ? (
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-zinc-900 underline underline-offset-2"
            >
              Parola ile yeniden giriş yap
            </Link>
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
            className="w-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Doğrulanıyor…" : "Doğrula ve devam et"}
          </button>
          <button
            type="button"
            className="w-full text-sm font-medium text-zinc-700 underline underline-offset-2"
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
          <p className="text-sm text-zinc-600">
            Kurtarma kodları tek kullanımlıktır. Kullandıktan sonra geçersiz olur.
          </p>
          <label className="block text-sm text-zinc-700">
            Kurtarma kodu
            <input
              className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 font-mono uppercase text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
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
            className="w-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "Doğrulanıyor…" : "Kurtarma kodu ile devam et"}
          </button>
          <button
            type="button"
            className="w-full text-sm font-medium text-zinc-700 underline underline-offset-2"
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
        <Link href="/login" className="underline underline-offset-2">
          Parola girişine dön
        </Link>
      </p>
    </div>
  );
}
