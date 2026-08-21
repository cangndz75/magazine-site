"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { PUBLICATION_STATUS, type PublicationStatus } from "@magazine/domain";
import {
  isSuccessfulSaveResponse,
  presentSaveFailure,
} from "@/lib/content/save-presentation";
import {
  INVALID_SLUG_MESSAGE,
  SLUG_CONFLICT_MESSAGE,
  presentSlugMutationCopy,
} from "@/lib/seo/slug-presentation";

type Props = {
  contentItemId: string;
  slug: string;
  publicationStatus: PublicationStatus;
  contentItemUpdatedAt: string;
  trustedSiteUrl: string;
  canEdit: boolean;
  onUpdated: (next: { slug: string; updatedAt: string }) => void;
};

export function ArticleSlugEditor({
  contentItemId,
  slug,
  publicationStatus,
  contentItemUpdatedAt,
  trustedSiteUrl,
  canEdit,
  onUpdated,
}: Props) {
  const router = useRouter();
  const copy = presentSlugMutationCopy(publicationStatus);
  const confirmId = useId();
  const [draft, setDraft] = useState(slug);
  const [acknowledge, setAcknowledge] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = draft.trim() !== slug;
  const canSubmit =
    canEdit &&
    changed &&
    !pending &&
    (!copy.requiresConsequence || acknowledge);

  async function save() {
    if (!canSubmit) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/content/${contentItemId}/slug`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: draft,
          expectedUpdatedAt: contentItemUpdatedAt,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: { slug: string; updatedAt: string };
        error?: { code: string; message: string };
      };
      if (
        !isSuccessfulSaveResponse({
          okHttp: response.ok,
          okBody: body.ok,
          hasData: Boolean(body.data),
        }) ||
        !body.data
      ) {
        if (body.error?.code === "SLUG_CONFLICT") {
          setError(SLUG_CONFLICT_MESSAGE);
          return;
        }
        if (body.error?.code === "INVALID_SLUG") {
          setError(INVALID_SLUG_MESSAGE);
          return;
        }
        setError(presentSaveFailure(body.error?.code, body.error?.message).message);
        return;
      }
      onUpdated({ slug: body.data.slug, updatedAt: body.data.updatedAt });
      setDraft(body.data.slug);
      setAcknowledge(false);
      router.refresh();
    } catch {
      setError("URL kaydedilemedi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-zinc-200 bg-white px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        Kamu URL
      </p>
      <p className="mt-1 break-all text-sm text-zinc-600">
        {trustedSiteUrl.replace(/\/$/, "")}/{slug}
      </p>
      <label htmlFor="article-slug" className="mt-3 mb-1 block text-sm font-medium text-zinc-700">
        Slug
      </label>
      <input
        id="article-slug"
        type="text"
        value={draft}
        disabled={!canEdit || pending}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        className="h-9 w-full rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
      />
      {publicationStatus === PUBLICATION_STATUS.PUBLISHED && (
        <p className="mt-2 text-sm text-zinc-600">{copy.publishedWarning}</p>
      )}
      {copy.requiresConsequence && (
        <label htmlFor={confirmId} className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
          <input
            id={confirmId}
            type="checkbox"
            checked={acknowledge}
            disabled={!canEdit || pending || !changed}
            onChange={(event) => setAcknowledge(event.target.checked)}
            className="mt-0.5"
          />
          <span>{copy.consequenceLabel}</span>
        </label>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void save()}
        className="mt-3 h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        {pending ? "Kaydediliyor..." : copy.submitLabel}
      </button>
    </div>
  );
}
