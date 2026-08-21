import { CAPABILITY } from "@magazine/domain";
import { getAnalyticsAuthors } from "@magazine/db/analytics";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { parseAnalyticsReportQuery } from "@/lib/analytics/query";
import { assertSafeAnalyticsDto } from "@/lib/analytics/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.ANALYTICS_READ, async (session) => {
    const query = parseAnalyticsReportQuery(new URL(request.url));
    const data = await getAnalyticsAuthors({
      period: query.period,
      scope: editorScopeFromSession(session),
    });
    assertSafeAnalyticsDto(data);
    return editorOk(data);
  });
}
