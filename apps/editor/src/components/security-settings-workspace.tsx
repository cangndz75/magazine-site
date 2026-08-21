"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { STAFF_MFA_FACTOR_STATUS } from "@magazine/domain";
import { MfaQrSetup } from "@/components/mfa-qr-setup";
import { MfaRecoveryCodesDisplay } from "@/components/mfa-recovery-codes-display";
import { MfaStepUpPassword } from "@/components/mfa-step-up-password";
import { MfaTotpInput } from "@/components/mfa-totp-input";
import {
  confirmTotpMfa,
  disableSelfMfa,
  enrollTotpMfa,
  regenerateMfaRecoveryCodes,
} from "@/lib/auth/mfa-client";
import {
  normalizeClientTotpInput,
  presentMfaEnrollmentFailure,
} from "@/lib/auth/mfa-presentation";

export type SecuritySettingsInitial = {
  email: string;
  displayName: string;
  passwordResetRequired: boolean;
  mfa: {
    enrolled: boolean;
    status: string;
    unusedRecoveryCodeCount: number;
  };
};

type SecurityView =
  | "overview"
  | "enroll-password"
  | "enroll-setup"
  | "recovery-codes"
  | "regenerate-password"
  | "disable-password";

type PendingEnrollment = {
  factorId: string;
  secret: string;
  otpauthUri: string;
};

type SecuritySettingsWorkspaceProps = {
  initial: SecuritySettingsInitial;
};

export function SecuritySettingsWorkspace({
  initial,
}: SecuritySettingsWorkspaceProps) {
  const router = useRouter();
  const [view, setView] = useState<SecurityView>("overview");
  const [mfaState, setMfaState] = useState(initial.mfa);
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [pendingEnrollment, setPendingEnrollment] = useState<PendingEnrollment | null>(
    null,
  );
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disableConfirm, setDisableConfirm] = useState(false);

  function clearSensitiveState() {
    setPassword("");
    setTotpCode("");
    setPendingEnrollment(null);
    setRecoveryCodes(null);
    setDisableConfirm(false);
    setError(null);
  }

  function refreshAfterMutation() {
    clearSensitiveState();
    setView("overview");
    router.refresh();
  }

  async function handleEnrollPasswordSubmit() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await enrollTotpMfa(password);
    setBusy(false);
    if (!result.ok) {
      setError(presentMfaEnrollmentFailure(result.code));
      return;
    }
    setPassword("");
    setPendingEnrollment({
      factorId: result.factorId,
      secret: result.secret,
      otpauthUri: result.otpauthUri,
    });
    setMfaState((current) => ({
      ...current,
      enrolled: false,
      status: STAFF_MFA_FACTOR_STATUS.PENDING,
    }));
    setView("enroll-setup");
  }

  async function handleConfirmEnrollment() {
    if (busy || !pendingEnrollment) {
      return;
    }
    const normalized = normalizeClientTotpInput(totpCode);
    if (!normalized) {
      setError("Altı haneli authenticator kodunu girin.");
      return;
    }
    setError(null);
    setBusy(true);
    const result = await confirmTotpMfa({
      factorId: pendingEnrollment.factorId,
      totpCode: normalized,
      password,
    });
    setBusy(false);
    if (!result.ok) {
      setError(presentMfaEnrollmentFailure(result.code));
      return;
    }
    setPassword("");
    setTotpCode("");
    setPendingEnrollment(null);
    setRecoveryCodes(result.recoveryCodes);
    setMfaState({
      enrolled: true,
      status: STAFF_MFA_FACTOR_STATUS.ACTIVE,
      unusedRecoveryCodeCount: result.recoveryCodes.length,
    });
    setView("recovery-codes");
  }

  async function handleRegenerate() {
    if (busy) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await regenerateMfaRecoveryCodes(password);
    setBusy(false);
    if (!result.ok) {
      setError(presentMfaEnrollmentFailure(result.code));
      return;
    }
    setPassword("");
    setRecoveryCodes(result.recoveryCodes);
    setMfaState((current) => ({
      ...current,
      unusedRecoveryCodeCount: result.recoveryCodes.length,
    }));
    setView("recovery-codes");
  }

  async function handleDisable() {
    if (busy || !disableConfirm) {
      return;
    }
    setError(null);
    setBusy(true);
    const result = await disableSelfMfa(password);
    setBusy(false);
    if (!result.ok) {
      setError(presentMfaEnrollmentFailure(result.code));
      return;
    }
    setMfaState({
      enrolled: false,
      status: STAFF_MFA_FACTOR_STATUS.DISABLED,
      unusedRecoveryCodeCount: 0,
    });
    refreshAfterMutation();
  }

  const pendingEnrollmentActive =
    mfaState.status === STAFF_MFA_FACTOR_STATUS.PENDING;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
        Güvenlik
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Hesabınızın iki adımlı doğrulama ve kurtarma ayarlarını yönetin.
      </p>

      {initial.passwordResetRequired ? (
        <div
          className="mt-6 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          Parola sıfırlaması gerekiyor. Yöneticinizden parola sıfırlaması isteyin; bu ekrandan parola değiştirilemez.
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-zinc-800" role="alert">
          {error}
        </p>
      ) : null}

      {view === "overview" ? (
        <section className="mt-8 space-y-6">
          <div className="rounded border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-medium text-zinc-900">İki adımlı doğrulama</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {mfaState.enrolled
                ? "Hesabınızda authenticator tabanlı iki adımlı doğrulama etkin."
                : pendingEnrollmentActive
                  ? "Kurulum başlatıldı ancak henüz tamamlanmadı."
                  : "Hesabınızda iki adımlı doğrulama etkin değil."}
            </p>
            {mfaState.enrolled ? (
              <p className="mt-2 text-sm text-zinc-600">
                Kullanılmayan kurtarma kodu:{" "}
                <span className="font-medium text-zinc-900">
                  {mfaState.unusedRecoveryCodeCount}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {!mfaState.enrolled && !pendingEnrollmentActive && !initial.passwordResetRequired ? (
              <button
                type="button"
                className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                onClick={() => {
                  clearSensitiveState();
                  setView("enroll-password");
                }}
              >
                İki adımlı doğrulamayı etkinleştir
              </button>
            ) : null}

            {pendingEnrollmentActive ? (
              <button
                type="button"
                className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
                onClick={() => {
                  clearSensitiveState();
                  setView("enroll-password");
                }}
              >
                Kuruluma devam et
              </button>
            ) : null}

            {mfaState.enrolled ? (
              <>
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  onClick={() => {
                    clearSensitiveState();
                    setView("regenerate-password");
                  }}
                >
                  Yeni kurtarma kodları oluştur
                </button>
                <button
                  type="button"
                  className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  onClick={() => {
                    clearSensitiveState();
                    setView("disable-password");
                  }}
                >
                  İki adımlı doğrulamayı kapat
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === "enroll-password" ? (
        <section className="mt-8 space-y-4">
          <p className="text-sm text-zinc-600">
            Kuruluma başlamadan önce mevcut parolanızı doğrulayın.
          </p>
          <MfaStepUpPassword value={password} onChange={setPassword} disabled={busy} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-500"
              disabled={busy}
              onClick={() => void handleEnrollPasswordSubmit()}
            >
              {busy ? "Hazırlanıyor…" : "Devam et"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900"
              onClick={() => {
                clearSensitiveState();
                setView("overview");
              }}
            >
              İptal
            </button>
          </div>
        </section>
      ) : null}

      {view === "enroll-setup" && pendingEnrollment ? (
        <section className="mt-8 space-y-6">
          <MfaQrSetup
            otpauthUri={pendingEnrollment.otpauthUri}
            secret={pendingEnrollment.secret}
            accountLabel={initial.email}
          />
          <p className="text-sm text-zinc-600">
            Kurulum tamamlanana kadar hesabınız henüz korunmuyor.
          </p>
          <MfaStepUpPassword
            value={password}
            onChange={setPassword}
            disabled={busy}
            label="Parolayı yeniden doğrulayın"
          />
          <MfaTotpInput
            value={totpCode}
            onChange={setTotpCode}
            disabled={busy}
            onEnter={() => void handleConfirmEnrollment()}
          />
          <button
            type="button"
            className="w-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-500"
            disabled={busy}
            onClick={() => void handleConfirmEnrollment()}
          >
            {busy ? "Doğrulanıyor…" : "Kurulumu tamamla"}
          </button>
        </section>
      ) : null}

      {view === "recovery-codes" && recoveryCodes ? (
        <section className="mt-8">
          <MfaRecoveryCodesDisplay
            codes={recoveryCodes}
            title="Kurtarma kodlarınız"
            description="Bu kodları güvenli bir yerde saklayın. Authenticator uygulamanıza erişemezseniz girişte kullanabilirsiniz."
            onAcknowledged={() => {
              setRecoveryCodes(null);
              refreshAfterMutation();
            }}
          />
        </section>
      ) : null}

      {view === "regenerate-password" ? (
        <section className="mt-8 space-y-4">
          <div className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Yeni kodlar oluşturulduğunda kullanılmamış eski kurtarma kodları geçersiz olur.
          </div>
          <MfaStepUpPassword value={password} onChange={setPassword} disabled={busy} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-500"
              disabled={busy}
              onClick={() => void handleRegenerate()}
            >
              {busy ? "Oluşturuluyor…" : "Yeni kodları oluştur"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900"
              onClick={() => {
                clearSensitiveState();
                setView("overview");
              }}
            >
              İptal
            </button>
          </div>
        </section>
      ) : null}

      {view === "disable-password" ? (
        <section className="mt-8 space-y-4">
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
            İki adımlı doğrulamayı kapatırsanız hesabınız yalnızca parola ile korunur. Kurtarma kodları ve authenticator ayarı silinir.
          </div>
          <MfaStepUpPassword value={password} onChange={setPassword} disabled={busy} />
          <label className="flex items-start gap-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-zinc-300"
              checked={disableConfirm}
              onChange={(event) => setDisableConfirm(event.target.checked)}
            />
            <span>İki adımlı doğrulamayı kapatmak istediğimi anlıyorum</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="rounded bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-500"
              disabled={busy || !disableConfirm}
              onClick={() => void handleDisable()}
            >
              {busy ? "Kapatılıyor…" : "İki adımlı doğrulamayı kapat"}
            </button>
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900"
              onClick={() => {
                clearSensitiveState();
                setView("overview");
              }}
            >
              İptal
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
