import { CAPABILITY } from "@magazine/domain";
import {
  getRedirectRule,
  listRedirectRuleAuditEvents,
  updateRedirectRule,
} from "@magazine/db/redirects";
import { withEditorRead, withEditorWrite } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { redirectActorFromSession } from "@/lib/redirects/actor";
import {
  parseRedirectRuleId,
  parseRedirectUpdateBody,
} from "@/lib/redirects/payload";
import {
  assertSafeRedirectHttpPayload,
  serializeRedirectAuditEvent,
  serializeRedirectRule,
} from "@/lib/redirects/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ redirectRuleId: string }> },
) {
  return withEditorRead(request, CAPABILITY.CONTENT_PUBLISH, async (session) => {
    const { redirectRuleId: rawId } = await context.params;
    const id = parseRedirectRuleId(rawId);
    const actor = redirectActorFromSession(session);
    const [rule, audit] = await Promise.all([
      getRedirectRule({ actor, id }),
      listRedirectRuleAuditEvents({ actor, redirectRuleId: id }),
    ]);
    const payload = {
      rule: serializeRedirectRule(rule),
      audit: audit.map(serializeRedirectAuditEvent),
    };
    assertSafeRedirectHttpPayload(payload);
    return editorOk(payload);
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ redirectRuleId: string }> },
) {
  return withEditorWrite(
    request,
    CAPABILITY.CONTENT_PUBLISH,
    async (session, body) => {
      const { redirectRuleId: rawId } = await context.params;
      const id = parseRedirectRuleId(rawId);
      const parsed = parseRedirectUpdateBody(body);
      const updated = await updateRedirectRule({
        actor: redirectActorFromSession(session),
        id,
        sourcePath: parsed.sourcePath,
        targetPath: parsed.targetPath,
        enabled: parsed.enabled,
        note: parsed.note,
        expectedUpdatedAt: parsed.expectedUpdatedAt,
      });
      const payload = serializeRedirectRule({
        ...updated,
        updatedByDisplayName: session.displayName,
      });
      assertSafeRedirectHttpPayload(payload);
      return editorOk(payload);
    },
  );
}
