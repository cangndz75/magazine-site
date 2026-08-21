import { CAPABILITY } from "@magazine/domain";
import {
  beginTotpEnrollment,
} from "@magazine/db/staff-mfa";
import { verifyStaffPasswordStepUp } from "@/lib/auth/authenticate";
import {
  getStaffMfaEncryptionKey,
  getStaffMfaTotpIssuer,
} from "@/lib/auth/mfa-config";
import { mapStaffMfaError, requireStepUpPassword } from "@/lib/auth/mfa-http";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { StaffMfaError } from "@magazine/domain";

export const dynamic = "force-dynamic";

function parseBodyRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {};
  }
  return body as Record<string, unknown>;
}

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_READ,
    async (session, body) => {
      try {
        const record = parseBodyRecord(body);
        const password = typeof record.password === "string" ? record.password : "";
        requireStepUpPassword(
          await verifyStaffPasswordStepUp({
            staffUserId: session.staffUserId,
            password,
          }),
        );

        const enrollment = await beginTotpEnrollment({
          staffUserId: session.staffUserId,
          email: session.email,
          issuer: getStaffMfaTotpIssuer(),
          encryptionKey: getStaffMfaEncryptionKey(),
        });

        return editorOk({
          factorId: enrollment.factorId,
          secret: enrollment.secret,
          otpauthUri: enrollment.otpauthUri,
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
