import { CAPABILITY } from "@magazine/domain";
import { lookupEditorCategories } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import { HomepageBuilderWorkspace } from "@/components/homepage-builder-workspace";
import { loadHomepageBuilderView } from "@/lib/homepage/builder-presentation";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Homepage Builder",
};

export default async function HomepageBuilderPage() {
  const session = await requireCapability(CAPABILITY.HOMEPAGE_MANAGE);
  const scope = queryScopeFromSession(session);

  const [builder, categoryOptions] = await Promise.all([
    loadHomepageBuilderView(session),
    lookupEditorCategories({ scopedCategoryIds: scope.scopedCategoryIds }),
  ]);

  return (
    <HomepageBuilderWorkspace
      initialBuilder={builder}
      categoryOptions={categoryOptions.map((option) => ({
        id: option.id,
        label: option.name,
      }))}
      siteUrl={env.SITE_URL}
    />
  );
}
