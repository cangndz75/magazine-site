import { CAPABILITY } from "@magazine/domain";
import { selfDisableMfa } from "@magazine/db/staff-mfa";
import { verifyStaffPasswordStepUp } from "@/lib/auth/authenticate";
import { mapStaffMfaError, requireStepUpPassword } from "@/lib/auth/mfa-http";
import { withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { StaffMfaError } from "@magazine/domain";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_READ,
    async (session, body) => {
      try {
        const record =
          typeof body === "object" && body !== null && !Array.isArray(body)
            ? (body as Record<string, unknown>)
            : {};
        const password = typeof record.password === "string" ? record.password : "";
        requireStepUpPassword(
          await verifyStaffPasswordStepUp({
            staffUserId: session.staffUserId,
            password,
          }),
        );

        await selfDisableMfa({ staffUserId: session.staffUserId });
        return editorOk({ disabled: true });
      } catch (error) {
        if (error instanceof StaffMfaError) {
          mapStaffMfaError(error);
        }
        throw error;
      }
    },
  );
}
