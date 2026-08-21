import { entityJsonLdType } from "../entity/projection";
import type { EntityKind } from "../entity/types";
import type { PublicEntitySeoInput } from "../entity/projection";
import { serializeJsonLd } from "./json-ld";

export type EntityProfileJsonLd = Record<string, unknown>;

function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalUrl(value: string | null | undefined): string | null {
  const text = optionalText(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function buildEntityProfileJsonLd(input: {
  kind: EntityKind;
  seo: PublicEntitySeoInput;
}): EntityProfileJsonLd | null {
  const name = optionalText(input.seo.name);
  const url = optionalUrl(input.seo.url);
  if (!name || !url) {
    return null;
  }

  const profilePage: EntityProfileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": url,
    url,
    name,
    mainEntity: {
      "@type": entityJsonLdType(input.kind),
      name,
      url,
    },
  };

  const description = optionalText(input.seo.description);
  if (description) {
    profilePage.description = description;
  }

  const image = optionalUrl(input.seo.image);
  if (image) {
    profilePage.image = image;
    (profilePage.mainEntity as EntityProfileJsonLd).image = image;
  }

  const birthDate = optionalText(input.seo.birthDate);
  if (birthDate && input.kind === "PERSON") {
    (profilePage.mainEntity as EntityProfileJsonLd).birthDate = birthDate;
  }

  const jobTitle = optionalText(input.seo.jobTitle);
  if (jobTitle && input.kind === "PERSON") {
    (profilePage.mainEntity as EntityProfileJsonLd).jobTitle = jobTitle;
  }

  const sameAs = optionalUrl(input.seo.sameAs);
  if (sameAs) {
    (profilePage.mainEntity as EntityProfileJsonLd).sameAs = sameAs;
  }

  return profilePage;
}

export function serializeEntityProfileJsonLd(
  jsonLd: EntityProfileJsonLd | null,
): string | null {
  if (!jsonLd) {
    return null;
  }
  return serializeJsonLd(jsonLd);
}
