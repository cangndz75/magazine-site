import Image from "next/image";
import type { PublicEntityProjection } from "@magazine/domain";
import { publicEntityKindLabel } from "@/lib/seo/entity-seo";
import { env } from "@/lib/env";

type PublicEntityProfileHeaderProps = {
  entity: PublicEntityProjection;
};

export function PublicEntityProfileHeader({ entity }: PublicEntityProfileHeaderProps) {
  const useUnoptimizedImage = env.APP_ENV === "development";
  const portrait = entity.portrait;
  const alternateNames =
    entity.alternateNames.length > 0 ? entity.alternateNames.join(", ") : null;

  return (
    <header className="public-entity-profile-header">
      <div className="public-entity-profile-header__intro">
        <p className="public-entity-profile-header__kind">
          {publicEntityKindLabel(entity.kind)}
        </p>
        <h1 className="public-entity-profile-header__name">{entity.canonicalName}</h1>
        {entity.summary ? (
          <p className="public-entity-profile-header__summary">{entity.summary}</p>
        ) : null}
        {alternateNames ? (
          <p className="public-entity-profile-header__aliases">
            <span className="public-entity-profile-header__aliases-label">Diğer adlar: </span>
            {alternateNames}
          </p>
        ) : null}
        <dl className="public-entity-profile-header__facts">
          {entity.occupation ? (
            <>
              <dt className="public-entity-profile-header__fact-label">Meslek</dt>
              <dd className="public-entity-profile-header__fact-value">{entity.occupation}</dd>
            </>
          ) : null}
          {entity.birthDate ? (
            <>
              <dt className="public-entity-profile-header__fact-label">Doğum tarihi</dt>
              <dd className="public-entity-profile-header__fact-value">{entity.birthDate}</dd>
            </>
          ) : null}
          {entity.officialWebsiteUrl ? (
            <>
              <dt className="public-entity-profile-header__fact-label">Resmî site</dt>
              <dd className="public-entity-profile-header__fact-value">
                <a
                  href={entity.officialWebsiteUrl}
                  className="public-entity-profile-header__website"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {entity.officialWebsiteUrl}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
      </div>
      {portrait?.url ? (
        <figure className="public-entity-profile-header__portrait">
          <Image
            src={portrait.url}
            alt={portrait.altText ?? entity.canonicalName}
            width={portrait.width ?? 480}
            height={portrait.height ?? 640}
            className="public-entity-profile-header__portrait-image"
            sizes="(max-width: 767px) 72vw, 240px"
            priority
            unoptimized={useUnoptimizedImage}
          />
          {portrait.credit ? (
            <figcaption className="public-entity-profile-header__portrait-credit">
              {portrait.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
    </header>
  );
}
