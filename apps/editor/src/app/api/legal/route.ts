import { CAPABILITY, decodeEditorListCursor } from "@magazine/domain";
import {
  clampLegalDashboardLimit,
  listLegalDashboard,
  listLegalDashboardActors,
} from "@magazine/db/editor";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { parseLegalDashboardQuery } from "@/lib/legal/payload";

export const dynamic = "force-dynamic";

function serializeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_LEGAL, async () => {
    const query = parseLegalDashboardQuery(new URL(request.url).searchParams);
    const cursor = query.cursor ? decodeEditorListCursor(query.cursor) : null;
    const result = await listLegalDashboard({
      actionType: query.actionType as never,
      search: query.search,
      activeHoldOnly: query.activeHoldOnly,
      actorStaffUserId: query.actorStaffUserId,
      effectiveAfter: query.effectiveAfter ? new Date(query.effectiveAfter) : undefined,
      effectiveBefore: query.effectiveBefore ? new Date(query.effectiveBefore) : undefined,
      limit: clampLegalDashboardLimit(query.limit),
      cursor,
    });
    const actors = await listLegalDashboardActors();

    return editorOk({
      activeHolds: result.activeHolds.map((hold) => ({
        ...hold,
        legalHoldAt: hold.legalHoldAt.toISOString(),
      })),
      entries: result.entries.map((entry) => ({
        ...entry,
        effectiveAt: entry.effectiveAt.toISOString(),
        createdAt: entry.createdAt.toISOString(),
        currentState: {
          ...entry.currentState,
          legalHoldAt: serializeDate(entry.currentState.legalHoldAt),
          retractedAt: serializeDate(entry.currentState.retractedAt),
          takedownAt: serializeDate(entry.currentState.takedownAt),
        },
      })),
      nextCursor: result.nextCursor,
      actors,
    });
  });
}
