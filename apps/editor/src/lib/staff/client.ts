import type {
  StaffAccountDetailHttpDto,
  StaffSessionHttpDto,
} from "./serialize";

type ApiEnvelope<T> = {
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

export async function patchStaffRoles(input: {
  staffUserId: string;
  roles: string[];
  expectedUpdatedAt: string;
}): Promise<
  | { ok: true; account: StaffAccountDetailHttpDto }
  | { ok: false; code?: string }
> {
  const response = await fetch(`/api/staff/${input.staffUserId}/roles`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      roles: input.roles,
      expectedUpdatedAt: input.expectedUpdatedAt,
    }),
  });
  const payload = await parseEnvelope<StaffAccountDetailHttpDto>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, account: payload.data };
}

export async function patchStaffScope(input: {
  staffUserId: string;
  scopeMode: string;
  scopedCategoryIds: string[];
  expectedUpdatedAt: string;
}): Promise<
  | { ok: true; account: StaffAccountDetailHttpDto }
  | { ok: false; code?: string }
> {
  const response = await fetch(`/api/staff/${input.staffUserId}/scope`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseEnvelope<StaffAccountDetailHttpDto>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, account: payload.data };
}

export async function patchStaffStatus(input: {
  staffUserId: string;
  status: string;
  expectedUpdatedAt: string;
}): Promise<
  | { ok: true; account: StaffAccountDetailHttpDto }
  | { ok: false; code?: string }
> {
  const response = await fetch(`/api/staff/${input.staffUserId}/status`, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const payload = await parseEnvelope<StaffAccountDetailHttpDto>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, account: payload.data };
}

export async function requireStaffPasswordResetAction(input: {
  staffUserId: string;
  expectedUpdatedAt: string;
}): Promise<
  | { ok: true; account: StaffAccountDetailHttpDto }
  | { ok: false; code?: string }
> {
  const response = await fetch(
    `/api/staff/${input.staffUserId}/password-reset-required`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ expectedUpdatedAt: input.expectedUpdatedAt }),
    },
  );
  const payload = await parseEnvelope<StaffAccountDetailHttpDto>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, account: payload.data };
}

export async function disableStaffMfaAction(input: {
  staffUserId: string;
  expectedUpdatedAt: string;
}): Promise<
  | { ok: true; account: StaffAccountDetailHttpDto }
  | { ok: false; code?: string }
> {
  const response = await fetch(`/api/staff/${input.staffUserId}/mfa/disable`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ expectedUpdatedAt: input.expectedUpdatedAt }),
  });
  const payload = await parseEnvelope<StaffAccountDetailHttpDto>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, account: payload.data };
}

export async function revokeStaffSessionAction(input: {
  staffUserId: string;
  sessionId: string;
}): Promise<{ ok: true } | { ok: false; code?: string }> {
  const response = await fetch(
    `/api/staff/${input.staffUserId}/sessions/${input.sessionId}`,
    { method: "DELETE", headers: { Accept: "application/json" } },
  );
  const payload = await parseEnvelope<{ revoked: boolean }>(response);
  if (!response.ok || payload.ok === false) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true };
}

export async function revokeAllStaffSessionsAction(input: {
  staffUserId: string;
  includeCurrentSession: boolean;
}): Promise<
  | {
      ok: true;
      revokedSessionCount: number;
      preservedCurrentSession: boolean;
    }
  | { ok: false; code?: string }
> {
  const response = await fetch(
    `/api/staff/${input.staffUserId}/sessions/revoke-all`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        includeCurrentSession: input.includeCurrentSession,
      }),
    },
  );
  const payload = await parseEnvelope<{
    revokedSessionCount: number;
    preservedSessionId: string | null;
    preservedCurrentSession: boolean;
  }>(response);
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return {
    ok: true,
    revokedSessionCount: payload.data.revokedSessionCount,
    preservedCurrentSession: payload.data.preservedCurrentSession,
  };
}

export async function fetchStaffSessions(staffUserId: string): Promise<
  | { ok: true; sessions: StaffSessionHttpDto[] }
  | { ok: false; code?: string }
> {
  const response = await fetch(`/api/staff/${staffUserId}/sessions`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await parseEnvelope<{ sessions: StaffSessionHttpDto[] }>(
    response,
  );
  if (!response.ok || payload.ok === false || !payload.data) {
    return { ok: false, code: payload.error?.code };
  }
  return { ok: true, sessions: payload.data.sessions };
}
