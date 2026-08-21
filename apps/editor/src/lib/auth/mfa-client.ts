export type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const raw = await response.text();
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw) as ApiEnvelope<T>;
}

export async function verifyMfaLoginChallenge(input: {
  totpCode?: string;
  recoveryCode?: string;
  returnTo: string;
}): Promise<
  | { ok: true; returnTo: string }
  | { ok: false; code?: string }
> {
  const response = await fetch("/api/auth/mfa/challenge/verify", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await parseEnvelope<{ returnTo: string }>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, returnTo: payload.data.returnTo };
}

export async function enrollTotpMfa(password: string): Promise<
  | { ok: true; factorId: string; secret: string; otpauthUri: string }
  | { ok: false; code?: string }
> {
  const response = await fetch("/api/auth/mfa/totp/enroll", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  const payload = await parseEnvelope<{
    factorId: string;
    secret: string;
    otpauthUri: string;
  }>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, ...payload.data };
}

export async function confirmTotpMfa(input: {
  factorId: string;
  totpCode: string;
  password: string;
}): Promise<
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; code?: string }
> {
  const response = await fetch("/api/auth/mfa/totp/confirm", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = await parseEnvelope<{ recoveryCodes: string[] }>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, recoveryCodes: payload.data.recoveryCodes };
}

export async function regenerateMfaRecoveryCodes(password: string): Promise<
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; code?: string }
> {
  const response = await fetch("/api/auth/mfa/recovery-codes/regenerate", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  const payload = await parseEnvelope<{ recoveryCodes: string[] }>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, recoveryCodes: payload.data.recoveryCodes };
}

export async function disableSelfMfa(password: string): Promise<
  | { ok: true }
  | { ok: false; code?: string }
> {
  const response = await fetch("/api/auth/mfa/disable", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  const payload = await parseEnvelope<{ disabled: boolean }>(response);
  if (!response.ok || payload.ok === false) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true };
}
