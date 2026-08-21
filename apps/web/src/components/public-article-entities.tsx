import Link from "next/link";
import type { EntityKind } from "@magazine/domain";
import type { PublicArticleEntityLink } from "@magazine/db/public";
import { publicEntityKindLabel } from "@/lib/seo/entity-seo";

type PublicArticleEntitiesProps = {
  entities: PublicArticleEntityLink[];
};

function entityKindLabel(kind: EntityKind | string): string {
  return publicEntityKindLabel(kind as EntityKind);
}

export function PublicArticleEntities({ entities }: PublicArticleEntitiesProps) {
  if (entities.length === 0) {
    return null;
  }

  return (
    <aside className="public-article-entities" aria-label="Bu haberde">
      <h2 className="public-article-entities__title">Bu haberde:</h2>
      <ul className="public-article-entities__list">
        {entities.map((entity) => (
          <li key={entity.entityId} className="public-article-entities__item">
            {entity.publicHref ? (
              <Link href={entity.publicHref} className="public-article-entities__link">
                <span className="public-article-entities__name">{entity.canonicalName}</span>
                <span className="public-article-entities__kind">
                  {entityKindLabel(entity.kind)}
                </span>
              </Link>
            ) : (
              <span className="public-article-entities__static">
                <span className="public-article-entities__name">{entity.canonicalName}</span>
                <span className="public-article-entities__kind">
                  {entityKindLabel(entity.kind)}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
