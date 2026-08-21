"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  STAFF_ROLE,
  STAFF_ROLES,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
  type StaffRole,
  type StaffScopeMode,
} from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import {
  disableStaffMfaAction,
  fetchStaffSessions,
  patchStaffRoles,
  patchStaffScope,
  patchStaffStatus,
  requireStaffPasswordResetAction,
  revokeAllStaffSessionsAction,
  revokeStaffSessionAction,
} from "@/lib/staff/client";
import {
  presentStaffAdminFailure,
  shortenStaffId,
  STAFF_ROLE_IMPACT,
  staffCapabilityLabel,
  staffMfaStatusLabel,
  staffRoleLabel,
  staffScopeModeLabel,
  staffSessionStateLabel,
  staffStatusLabel,
} from "@/lib/staff/presentation";
import type {
  StaffAccountDetailHttpDto,
  StaffSessionHttpDto,
} from "@/lib/staff/serialize";
import { LookupMultiPicker } from "./lookup-multi-picker";
import type { LookupPickerOption } from "./lookup-picker";
import { StaffConfirmDialog } from "./staff-confirm-dialog";
import {
  StaffSecurityAuditTimeline,
  type StaffSecurityAuditItem,
} from "./staff-security-audit-timeline";
import { StatusBadge } from "./status-badge";

type DialogKind =
  | "suspend"
  | "reactivate"
  | "password-reset"
  | "mfa-disable"
  | "revoke-session"
  | "revoke-all"
  | "revoke-all-current"
  | "role-super-admin"
  | null;

type Props = {
  initialAccount: StaffAccountDetailHttpDto;
  initialSessions: StaffSessionHttpDto[];
  auditItems: StaffSecurityAuditItem[];
  categoryLabels: Record<string, string>;
  actorStaffUserId: string;
};

export function StaffDetailWorkspace({
  initialAccount,
  initialSessions,
  auditItems,
  categoryLabels,
  actorStaffUserId,
}: Props) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount);
  const [sessions, setSessions] = useState(initialSessions);
  const [draftRoles, setDraftRoles] = useState<StaffRole[]>([...account.roles]);
  const [draftScopeMode, setDraftScopeMode] = useState<StaffScopeMode>(
    account.scopeMode,
  );
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([
    ...account.scopedCategoryIds,
  ]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [targetSessionId, setTargetSessionId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<StaffRole[] | null>(null);

  const isSelf = actorStaffUserId === account.id;
  const rolesDirty =
    draftRoles.length !== account.roles.length ||
    draftRoles.some((role) => !account.roles.includes(role));
  const scopeDirty =
    draftScopeMode !== account.scopeMode ||
    draftCategoryIds.length !== account.scopedCategoryIds.length ||
    draftCategoryIds.some((id) => !account.scopedCategoryIds.includes(id));

  const selectedCategories: LookupPickerOption[] = useMemo(
    () =>
      draftCategoryIds.map((id) => ({
        id,
        label: categoryLabels[id] ?? id,
      })),
    [categoryLabels, draftCategoryIds],
  );

  const handleMutationError = useCallback((code?: string) => {
    const presented = presentStaffAdminFailure(code);
    setError(presented.message);
    setConflict(presented.isConflict);
  }, []);

  const applyAccount = useCallback((next: StaffAccountDetailHttpDto) => {
    setAccount(next);
    setDraftRoles([...next.roles]);
    setDraftScopeMode(next.scopeMode);
    setDraftCategoryIds([...next.scopedCategoryIds]);
    setError(null);
    setConflict(false);
    router.refresh();
  }, [router]);

  const reloadSessions = useCallback(async () => {
    const result = await fetchStaffSessions(account.id);
    if (result.ok) {
      setSessions(result.sessions);
    }
  }, [account.id]);

  const searchCategories = useCallback(async (query: string) => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const response = await fetch(`/api/lookups/categories?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const payload = (await response.json()) as {
      data?: { items: { id: string; name: string; slug: string }[] };
    };
    return (payload.data?.items ?? []).map((item) => ({
      id: item.id,
      label: item.name,
      meta: item.slug,
    }));
  }, []);

  async function saveRoles(roles: StaffRole[]) {
    setPending(true);
    setError(null);
    const result = await patchStaffRoles({
      staffUserId: account.id,
      roles,
      expectedUpdatedAt: account.updatedAt,
    });
    setPending(false);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    applyAccount(result.account);
    await reloadSessions();
  }

  async function saveScope() {
    setPending(true);
    setError(null);
    const result = await patchStaffScope({
      staffUserId: account.id,
      scopeMode: draftScopeMode,
      scopedCategoryIds:
        draftScopeMode === STAFF_SCOPE_MODE.SELECTED ? draftCategoryIds : [],
      expectedUpdatedAt: account.updatedAt,
    });
    setPending(false);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    applyAccount(result.account);
  }

  function requestSaveRoles() {
    const hadSuperAdmin = account.roles.includes(STAFF_ROLE.SUPER_ADMIN);
    const hasSuperAdmin = draftRoles.includes(STAFF_ROLE.SUPER_ADMIN);
    if (hadSuperAdmin !== hasSuperAdmin) {
      setPendingRoles([...draftRoles]);
      setDialog("role-super-admin");
      return;
    }
    if (
      isSelf &&
      hadSuperAdmin &&
      !hasSuperAdmin
    ) {
      setPendingRoles([...draftRoles]);
      setDialog("role-super-admin");
      return;
    }
    void saveRoles(draftRoles);
  }

  async function confirmSuspendOrReactivate() {
    const nextStatus =
      account.status === STAFF_STATUS.ACTIVE
        ? STAFF_STATUS.DISABLED
        : STAFF_STATUS.ACTIVE;
    setPending(true);
    const result = await patchStaffStatus({
      staffUserId: account.id,
      status: nextStatus,
      expectedUpdatedAt: account.updatedAt,
    });
    setPending(false);
    setDialog(null);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    applyAccount(result.account);
    await reloadSessions();
    if (isSelf && nextStatus === STAFF_STATUS.DISABLED) {
      router.replace("/login");
    }
  }

  async function confirmPasswordReset() {
    setPending(true);
    const result = await requireStaffPasswordResetAction({
      staffUserId: account.id,
      expectedUpdatedAt: account.updatedAt,
    });
    setPending(false);
    setDialog(null);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    applyAccount(result.account);
    await reloadSessions();
    if (isSelf) {
      router.replace("/login");
    }
  }

  async function confirmMfaDisable() {
    setPending(true);
    const result = await disableStaffMfaAction({
      staffUserId: account.id,
      expectedUpdatedAt: account.updatedAt,
    });
    setPending(false);
    setDialog(null);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    applyAccount(result.account);
  }

  async function confirmRevokeSession() {
    if (!targetSessionId) {
      return;
    }
    setPending(true);
    const result = await revokeStaffSessionAction({
      staffUserId: account.id,
      sessionId: targetSessionId,
    });
    setPending(false);
    setDialog(null);
    setTargetSessionId(null);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    await reloadSessions();
    router.refresh();
  }

  async function confirmRevokeAll(includeCurrentSession: boolean) {
    setPending(true);
    const result = await revokeAllStaffSessionsAction({
      staffUserId: account.id,
      includeCurrentSession,
    });
    setPending(false);
    setDialog(null);
    if (!result.ok) {
      handleMutationError(result.code);
      return;
    }
    await reloadSessions();
    router.refresh();
    if (isSelf && !result.preservedCurrentSession) {
      router.replace("/login");
    }
  }

  const selfSuspendWarning = isSelf
    ? "Kendi hesabınızı devre dışı bırakıyorsunuz; oturumunuz sonlandırılacak ve giriş yapamayacaksınız."
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <Link
          href="/staff"
          className="text-xs text-zinc-500 hover:text-zinc-800"
        >
          ← Personel listesi
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-zinc-900">
          {account.displayName}
        </h1>
        <p className="text-sm text-zinc-600">{account.email}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          <StatusBadge
            label={staffStatusLabel(account.status)}
            variant={
              account.status === STAFF_STATUS.ACTIVE ? "success" : "warning"
            }
          />
          {account.passwordResetRequired && (
            <StatusBadge
              label="Parola sıfırlama gerekli"
              variant="warning"
            />
          )}
        </div>
      </div>

      {(error || conflict) && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
        >
          <p>{error}</p>
          {conflict && (
            <button
              type="button"
              onClick={() => router.refresh()}
              className="mt-2 text-xs font-medium underline"
            >
              Sayfayı yenile
            </button>
          )}
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Kimlik
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Görünen ad</dt>
              <dd className="font-medium text-zinc-900">{account.displayName}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">E-posta</dt>
              <dd className="text-zinc-900">{account.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Oluşturulma</dt>
              <dd>{formatDateTime(account.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Son güncelleme</dt>
              <dd>{formatDateTime(account.updatedAt)}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Erişim
          </h2>
          <div className="mt-3 space-y-4">
            <fieldset>
              <legend className="text-sm font-medium text-zinc-900">Roller</legend>
              <p className="mt-1 text-xs text-zinc-600">
                Yetkiler sunucu tarafından role göre türetilir; ayrı ayrı
                düzenlenemez.
              </p>
              <div className="mt-2 space-y-2">
                {STAFF_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex items-start gap-2 rounded border border-zinc-100 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={draftRoles.includes(role)}
                      onChange={(event) => {
                        setDraftRoles((current) => {
                          if (event.target.checked) {
                            return [...new Set([...current, role])];
                          }
                          return current.filter((item) => item !== role);
                        });
                      }}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {staffRoleLabel(role)}
                      </span>
                      <span className="block text-xs text-zinc-600">
                        {STAFF_ROLE_IMPACT[role]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {rolesDirty && (
                <button
                  type="button"
                  disabled={pending || draftRoles.length === 0}
                  onClick={requestSaveRoles}
                  className="mt-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  Rolleri kaydet
                </button>
              )}
            </fieldset>

            <div>
              <p className="text-xs font-medium text-zinc-600">
                Etkin yetkiler
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {account.capabilities.map((cap) => (
                  <StatusBadge
                    key={cap}
                    label={staffCapabilityLabel(cap)}
                    variant="neutral"
                  />
                ))}
              </ul>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-zinc-900">
                Kategori kapsamı
              </legend>
              <p className="mt-1 text-xs text-zinc-600">
                Bu personelin hangi içerik kategorilerinde çalışabileceğini
                belirler.
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scopeMode"
                    checked={draftScopeMode === STAFF_SCOPE_MODE.ALL}
                    onChange={() => setDraftScopeMode(STAFF_SCOPE_MODE.ALL)}
                  />
                  Tüm kategoriler
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="scopeMode"
                    checked={draftScopeMode === STAFF_SCOPE_MODE.SELECTED}
                    onChange={() =>
                      setDraftScopeMode(STAFF_SCOPE_MODE.SELECTED)
                    }
                  />
                  Seçili kategoriler
                </label>
              </div>
              {draftScopeMode === STAFF_SCOPE_MODE.SELECTED && (
                <div className="mt-3">
                  <LookupMultiPicker
                    label="Kategoriler"
                    addLabel="Kategori ekle"
                    searchPlaceholder="Kategori ara…"
                    selected={selectedCategories}
                    onAdd={(option) =>
                      setDraftCategoryIds((current) =>
                        current.includes(option.id)
                          ? current
                          : [...current, option.id],
                      )
                    }
                    onRemove={(id) =>
                      setDraftCategoryIds((current) =>
                        current.filter((item) => item !== id),
                      )
                    }
                    onSearch={searchCategories}
                    emptyLabel="Kategori bulunamadı"
                    errorLabel="Kategoriler yüklenemedi"
                  />
                </div>
              )}
              {scopeDirty && (
                <button
                  type="button"
                  disabled={
                    pending ||
                    (draftScopeMode === STAFF_SCOPE_MODE.SELECTED &&
                      draftCategoryIds.length === 0)
                  }
                  onClick={() => void saveScope()}
                  className="mt-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  Kapsamı kaydet
                </button>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Mevcut: {staffScopeModeLabel(account.scopeMode)}
                {account.scopeMode === STAFF_SCOPE_MODE.SELECTED &&
                  ` (${account.scopedCategoryIds.length} kategori)`}
              </p>
            </fieldset>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Güvenlik
          </h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">MFA durumu</dt>
              <dd>{staffMfaStatusLabel(account.mfa)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Kurtarma kodları</dt>
              <dd>{account.mfa.unusedRecoveryCodeCount} kullanılmamış</dd>
            </div>
            {account.mfa.confirmedAt && (
              <div>
                <dt className="text-xs text-zinc-500">MFA onay tarihi</dt>
                <dd>{formatDateTime(account.mfa.confirmedAt)}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-zinc-500">Parola değişimi</dt>
              <dd>
                {account.passwordChangedAt
                  ? formatDateTime(account.passwordChangedAt)
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            {account.mfa.enrolled && (
              <button
                type="button"
                onClick={() => setDialog("mfa-disable")}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50"
              >
                MFA&apos;yı devre dışı bırak
              </button>
            )}
            <button
              type="button"
              onClick={() => setDialog("password-reset")}
              className="rounded border border-amber-300 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50"
            >
              Parola sıfırlamayı zorunlu kıl
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Oturumlar
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialog("revoke-all")}
                className="rounded border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
              >
                Tüm oturumları sonlandır
              </button>
              {isSelf && (
                <button
                  type="button"
                  onClick={() => setDialog("revoke-all-current")}
                  className="rounded border border-red-300 px-2.5 py-1 text-xs text-red-800 hover:bg-red-50"
                >
                  Mevcut oturum dahil tümünü sonlandır
                </button>
              )}
            </div>
          </div>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Kayıtlı oturum yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 rounded border border-zinc-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <StatusBadge
                      label={staffSessionStateLabel(session.state)}
                      variant={
                        session.state === "ACTIVE" ? "success" : "neutral"
                      }
                    />
                    <p className="mt-1 text-xs text-zinc-600">
                      Oturum: {shortenStaffId(session.id)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      Son görülme: {formatDateTime(session.lastSeenAt)} · Bitiş:{" "}
                      {formatDateTime(session.expiresAt)}
                    </p>
                  </div>
                  {session.state === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => {
                        setTargetSessionId(session.id);
                        setDialog("revoke-session");
                      }}
                      className="self-start rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 sm:self-center"
                    >
                      Oturumu sonlandır
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Güvenlik denetimi
          </h2>
          <div className="mt-3">
            <StaffSecurityAuditTimeline items={auditItems} />
          </div>
        </section>

        <section className="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <h2 className="text-sm font-semibold text-red-900">Hesap durumu</h2>
          {account.status === STAFF_STATUS.ACTIVE ? (
            <>
              <p className="mt-2 text-sm text-red-800">
                Personeli devre dışı bıraktığınızda aktif oturumları
                sonlandırılır ve giriş engellenir.
              </p>
              <button
                type="button"
                onClick={() => setDialog("suspend")}
                className="mt-3 rounded border border-red-800 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100"
              >
                Personeli devre dışı bırak
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-red-800">
                Hesabı yeniden etkinleştirdiğinizde giriş yapılabilir hale gelir;
                MFA ve parola durumu otomatik sıfırlanmaz.
              </p>
              <button
                type="button"
                onClick={() => setDialog("reactivate")}
                className="mt-3 rounded border border-zinc-700 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Hesabı yeniden etkinleştir
              </button>
            </>
          )}
        </section>
      </div>

      <StaffConfirmDialog
        open={dialog === "suspend"}
        pending={pending}
        title="Personeli devre dışı bırak"
        description={`${account.displayName} (${account.email}) hesabı askıya alınacak. Aktif oturumlar sonlandırılır ve giriş engellenir.`}
        warning={selfSuspendWarning}
        confirmLabel="Personeli devre dışı bırak"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmSuspendOrReactivate()}
      />

      <StaffConfirmDialog
        open={dialog === "reactivate"}
        pending={pending}
        title="Hesabı yeniden etkinleştir"
        description={`${account.displayName} (${account.email}) tekrar giriş yapabilir. MFA ve parola ayarları değişmez.`}
        confirmLabel="Hesabı yeniden etkinleştir"
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmSuspendOrReactivate()}
      />

      <StaffConfirmDialog
        open={dialog === "password-reset"}
        pending={pending}
        title="Parola sıfırlamayı zorunlu kıl"
        description={`${account.displayName} için parola sıfırlama zorunlu kılınacak. Aktif oturumlar sonlandırılır; e-posta gönderilmez. Parola değişimi mevcut CLI süreciyle yapılır.`}
        warning={
          isSelf
            ? "Kendi hesabınızda bu işlem sizi oturumdan çıkarır ve parola sıfırlaması tamamlanana kadar giriş yapamazsınız."
            : null
        }
        confirmLabel="Parola sıfırlamayı zorunlu kıl"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmPasswordReset()}
      />

      <StaffConfirmDialog
        open={dialog === "mfa-disable"}
        pending={pending}
        title="MFA'yı devre dışı bırak"
        description={`${account.displayName} için MFA kaldırılacak. Authenticator gizli anahtarı ve kurtarma kodları silinir.`}
        confirmLabel="MFA'yı devre dışı bırak"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmMfaDisable()}
      />

      <StaffConfirmDialog
        open={dialog === "revoke-session"}
        pending={pending}
        title="Oturumu sonlandır"
        description={`${account.displayName} için seçili oturum (${targetSessionId ? shortenStaffId(targetSessionId) : ""}) sonlandırılacak.`}
        confirmLabel="Oturumu sonlandır"
        destructive
        onCancel={() => {
          setDialog(null);
          setTargetSessionId(null);
        }}
        onConfirm={() => void confirmRevokeSession()}
      />

      <StaffConfirmDialog
        open={dialog === "revoke-all"}
        pending={pending}
        title="Tüm oturumları sonlandır"
        description={`${account.displayName} için tüm oturumlar sonlandırılacak.${isSelf ? " Mevcut oturumunuz varsayılan olarak korunur." : ""}`}
        confirmLabel="Tüm oturumları sonlandır"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmRevokeAll(false)}
      />

      <StaffConfirmDialog
        open={dialog === "revoke-all-current"}
        pending={pending}
        title="Mevcut oturum dahil tümünü sonlandır"
        description="Tüm oturumlar sonlandırılacak; mevcut oturumunuz da dahil. Hemen çıkış yapılır."
        warning="Bu işlem sizi oturumdan çıkarır."
        confirmLabel="Mevcut oturum dahil sonlandır"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={() => void confirmRevokeAll(true)}
      />

      <StaffConfirmDialog
        open={dialog === "role-super-admin"}
        pending={pending}
        title="Süper Admin rolü değişikliği"
        description={`${account.displayName} için Süper Admin rolü değiştirilecek. Bu işlem tam yönetim yetkilerini etkiler.`}
        warning={
          isSelf
            ? "Kendi Süper Admin rolünüzü kaldırıyorsanız personel yönetimine erişiminiz kaybolabilir."
            : null
        }
        confirmLabel="Rol değişikliğini onayla"
        destructive
        onCancel={() => {
          setDialog(null);
          setPendingRoles(null);
        }}
        onConfirm={() => {
          if (pendingRoles) {
            void saveRoles(pendingRoles);
          }
          setDialog(null);
          setPendingRoles(null);
        }}
      />
    </div>
  );
}
