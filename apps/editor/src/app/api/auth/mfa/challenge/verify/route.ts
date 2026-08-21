import { verifyLoginChallenge } from "@magazine/db/staff-mfa";
import { assertEditorOrigin, safeInternalPath } from "@/lib/auth/origin";
import { env } from "@/lib/env";
import {
  clearMfaChallengeCookie,
  readMfaChallengeTokenFromCookie,
} from "@/lib/auth/mfa-challenge-cookie";
import { getStaffMfaEncryptionKey } from "@/lib/auth/mfa-config";
import { mapStaffMfaError } from "@/lib/auth/mfa-http";
import {
  EDITOR_API_ERROR,
  EditorHttpError,
  editorOk,
  mapEditorError,
  readEditorJsonBody,
} from "@/lib/content/http";
import { applySessionCookie, createStaffSession } from "@/lib/auth/session";
import { StaffMfaError } from "@magazine/domain";

export const dynamic = "force-dynamic";

function parseVerifyBody(body: unknown): {
  totpCode?: string;
  recoveryCode?: string;
  returnTo: string;
} {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { returnTo: "/" };
  }
  const record = body as Record<string, unknown>;
  return {
    totpCode: typeof record.totpCode === "string" ? record.totpCode : undefined,
    recoveryCode:
      typeof record.recoveryCode === "string" ? record.recoveryCode : undefined,
    returnTo:
      typeof record.returnTo === "string"
        ? safeInternalPath(record.returnTo) ?? "/"
        : "/",
  };
}

export async function POST(request: Request) {
  try {
    assertEditorOrigin(request, env.EDITOR_URL);
    const body = await readEditorJsonBody(request);
    const challengeToken = await readMfaChallengeTokenFromCookie();
    if (!challengeToken) {
      throw new EditorHttpError(
        401,
        EDITOR_API_ERROR.UNAUTHENTICATED,
        "MFA challenge is required.",
      );
    }

    const parsed = parseVerifyBody(body);
    const result = await verifyLoginChallenge({
      challengeToken,
      totpCode: parsed.totpCode,
      recoveryCode: parsed.recoveryCode,
      encryptionKey: getStaffMfaEncryptionKey(),
    });

    const token = await createStaffSession(result.staffUserId);
    await clearMfaChallengeCookie();
    await applySessionCookie(token);

    return editorOk({ returnTo: parsed.returnTo });
  } catch (error) {
    if (error instanceof StaffMfaError) {
      try {
        mapStaffMfaError(error);
      } catch (mapped) {
        return mapEditorError(mapped);
      }
    }
    return mapEditorError(error);
  }
}
