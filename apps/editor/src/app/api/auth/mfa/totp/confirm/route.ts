import { CAPABILITY } from "@magazine/domain";
import { confirmTotpEnrollment } from "@magazine/db/staff-mfa";
import { verifyStaffPasswordStepUp } from "@/lib/auth/authenticate";
import { getStaffMfaEncryptionKey } from "@/lib/auth/mfa-config";
import { mapStaffMfaError, requireStepUpPassword } from "@/lib/auth/mfa-http";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { StaffMfaError } from "@magazine/domain";

export const dynamic = "force-dynamic";

function parseConfirmBody(body: unknown): {
  factorId: string;
  totpCode: string;
  password: string;
} {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { factorId: "", totpCode: "", password: "" };
  }
  const record = body as Record<string, unknown>;
  return {
    factorId: typeof record.factorId === "string" ? record.factorId : "",
    totpCode: typeof record.totpCode === "string" ? record.totpCode : "",
    password: typeof record.password === "string" ? record.password : "",
  };
}

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_READ,
    async (session, body) => {
      try {
        const parsed = parseConfirmBody(body);
        requireStepUpPassword(
          await verifyStaffPasswordStepUp({
            staffUserId: session.staffUserId,
            password: parsed.password,
          }),
        );

        const result = await confirmTotpEnrollment({
          staffUserId: session.staffUserId,
          factorId: parsed.factorId,
          totpCode: parsed.totpCode,
          encryptionKey: getStaffMfaEncryptionKey(),
        });

        return editorOk({
          recoveryCodes: result.recoveryCodes,
        });
      } catch (error) {
        if (error instanceof StaffMfaError) {
          mapStaffMfaError(error);
        }
        throw error;
      }
    },
  );
}
