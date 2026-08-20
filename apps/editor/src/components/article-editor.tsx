"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthorRole, Credibility, EntityKind, EntityRole, MediaRole } from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import { deriveContentStatus } from "@/lib/content/status";
import { ArticleAuditHistory } from "@/components/article-audit-history";
import { ArticleMetadataEditor } from "@/components/article-metadata-editor";
import { ArticleRevisionPanel } from "@/components/article-revision-panel";
import { ArticleReviewPanel, type ReviewHistoryItem } from "@/components/article-review-panel";
import { StructuredBodyEditor } from "@/components/structured-body-editor";
import { StatusBadge } from "@/components/status-badge";
import {
  cloneBodyEditorDocument,
  editorDocumentToBody,
  type BodyEditorDocument,
} from "@/lib/content/body-editor-state";
import {
  CREDIBILITY_LABELS,
  normalizeArticleEditorFields,
  validateArticleEditorFields,
  type ArticleEditorFields,
} from "@/lib/content/article-editor-state";
import {
  cloneArticleEditorRelations,
  setArticleVideos,
  setGalleryMedia,
  setHeroMedia,
  toDraftRelationPayload,
  type ArticleEditorMedia,
  type ArticleEditorRelations,
  type ArticleEditorVideo,
} from "@/lib/content/article-relation-state";
import {
  createArticleEditorDraftSnapshot,
  isArticleEditorDirty,
} from "@/lib/content/article-editor-session";
import {
  isSuccessfulSaveResponse,
  presentSaveFailure,
} from "@/lib/content/save-presentation";
import {
  AUTHOR_ROLE_LABELS,
  PUBLICATION_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  type RevisionHistoryItem,
} from "@/lib/content/revision-presentation";
import { ArticleWorkflowPanel } from "@/components/article-workflow-panel";
import { ArticleLegalHoldBanner } from "@/components/article-legal-hold-banner";
import { ArticleLegalPanel } from "@/components/article-legal-panel";
import { LEGAL_HOLD_BLOCKED_COPY } from "@/lib/legal/presentation";
import { formatEditorialDateTime } from "@/lib/content/editorial-timezone";
import type { WorkflowEligibilityInput } from "@/lib/content/workflow-eligibility";

type ArticleEditorModel = {
  contentItem: {
    id: string;
    slug: string;
    publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
    publishedVersionId: string | null;
    draftVersionId: string | null;
    scheduledVersionId: string | null;
    scheduledAt: string | null;
    scheduleGeneration: number;
    publishedAt: string | null;
    publicDateModified: string | null;
    updatedAt: string;
    legalHoldAt: string | null;
    legalHoldReason: string | null;
    retractedAt: string | null;
    takedownAt: string | null;
  };
  displayVersionId: string | null;
  editableVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    createdAt: string;
    fields: ArticleEditorFields;
    body: unknown;
    canEdit: boolean;
    concurrencyToken: string;
    relations: {
      categories: {
        id: string;
        name: string;
        slug: string;
        parentName: string | null;
        isPrimary: boolean;
      }[];
      authors: {
        id: string;
        displayName: string;
        slug: string;
        role: AuthorRole;
        sortOrder: number;
      }[];
      tags: { id: string; name: string; slug: string }[];
      entities: {
        id: string;
        name: string;
        kind: EntityKind;
        role: EntityRole;
        sortOrder: number;
      }[];
        media: {
        id: string;
        label: string;
        mediaType: string;
        width: number | null;
        height: number | null;
        role: MediaRole;
        sortOrder: number;
        caption: string | null;
        altText: string | null;
        credit: string | null;
        previewUrl?: string | null;
        creatorName?: string | null;
        creditLine?: string | null;
        eligibility?: {
          eligible: boolean;
          status: string;
          reasons: string[];
        } | null;
      }[];
      videos: ArticleEditorVideo[];
    };
  } | null;
  publishedVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    title: string;
  } | null;
  draftVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    title: string;
  } | null;
  scheduledVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    title: string;
  } | null;
};

type Props = {
  model: ArticleEditorModel;
  returnHref: string;
  fromReview: boolean;
  focusedVersionId: string | null;
  revisions: {
    versions: RevisionHistoryItem[];
    nextCursor: string | null;
  };
  reviewEvents: ReviewHistoryItem[];
  permissions: {
    canEdit: boolean;
    canReview: boolean;
    canPublish: boolean;
    canLegal: boolean;
  };
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saved"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

const PUBLICATION_AXIS_LABEL = "Yayın durumu";
const WORKFLOW_AXIS_LABEL = "İş akışı";

export function ArticleEditor({
  model,
  returnHref,
  fromReview,
  focusedVersionId,
  revisions,
  reviewEvents,
  permissions,
}: Props) {
  const router = useRouter();
  const version = model.editableVersion;
  const initialSnapshot = createArticleEditorDraftSnapshot(version);
  const [baseline, setBaseline] = useState<ArticleEditorFields | null>(
    initialSnapshot.fields,
  );
  const [fields, setFields] = useState<ArticleEditorFields | null>(
    initialSnapshot.fields,
  );
  const [baselineRelations, setBaselineRelations] = useState<ArticleEditorRelations>(
    initialSnapshot.relations,
  );
  const [relations, setRelations] = useState<ArticleEditorRelations>(
    initialSnapshot.relations,
  );
  const [baselineBody, setBaselineBody] = useState<BodyEditorDocument | null>(
    initialSnapshot.body,
  );
  const [bodyDocument, setBodyDocument] = useState<BodyEditorDocument | null>(
    initialSnapshot.body,
  );
  const [bodyError, setBodyError] = useState<string | null>(initialSnapshot.bodyError);
  const [token, setToken] = useState(version?.concurrencyToken ?? "");
  const [boundVersionId, setBoundVersionId] = useState(version?.id ?? null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isSaving, setIsSaving] = useState(false);
  const [heroBusy, setHeroBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [videoBusy, setVideoBusy] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  if (boundVersionId !== (version?.id ?? null)) {
    const nextSnapshot = createArticleEditorDraftSnapshot(version);
    setBoundVersionId(version?.id ?? null);
    setFields(nextSnapshot.fields);
    setBaseline(nextSnapshot.fields);
    setRelations(nextSnapshot.relations);
    setBaselineRelations(nextSnapshot.relations);
    setBaselineBody(nextSnapshot.body);
    setBodyDocument(nextSnapshot.body);
    setBodyError(nextSnapshot.bodyError);
    setToken(version?.concurrencyToken ?? "");
    setSaveState({ kind: "idle" });
  }

  const validation = useMemo(
    () => (fields ? validateArticleEditorFields(fields) : { ok: true, errors: {} }),
    [fields],
  );
  const isDirty = isArticleEditorDirty({
    fields,
    baseline,
    relations,
    baselineRelations,
    body: bodyDocument,
    baselineBody,
  });

  if (
    boundVersionId === (version?.id ?? null) &&
    !isDirty &&
    version?.concurrencyToken &&
    version.concurrencyToken !== token
  ) {
    setToken(version.concurrencyToken);
  }
  const canEdit = Boolean(
    permissions.canEdit &&
      version?.canEdit &&
      fields &&
      baseline &&
      bodyDocument &&
      baselineBody,
  );
  const legalHoldActive = model.contentItem.legalHoldAt !== null;
  const effectiveCanEdit = canEdit && !legalHoldActive;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const status = version
    ? deriveContentStatus({
        publicationStatus: model.contentItem.publicationStatus,
        workflowStatus: version.workflowStatus,
        publishedVersionId: model.contentItem.publishedVersionId,
        draftVersionId: model.contentItem.draftVersionId,
        scheduledVersionId: model.contentItem.scheduledVersionId,
        scheduledAt: model.contentItem.scheduledAt,
        displayVersionId: version.id,
      })
    : null;

  const eligibility = useMemo<WorkflowEligibilityInput>(
    () => ({
      contentItemId: model.contentItem.id,
      publicationStatus: model.contentItem.publicationStatus,
      workflowStatus: version?.workflowStatus ?? null,
      focusedVersionId: version?.id ?? focusedVersionId,
      focusedVersionNumber: version?.versionNumber ?? null,
      draftVersionId: model.contentItem.draftVersionId,
      publishedVersionId: model.contentItem.publishedVersionId,
      scheduledVersionId: model.contentItem.scheduledVersionId,
      scheduledAt: model.contentItem.scheduledAt,
      publishedVersionNumber: model.publishedVersion?.versionNumber ?? null,
      draftVersionNumber: model.draftVersion?.versionNumber ?? null,
      scheduledVersionNumber: model.scheduledVersion?.versionNumber ?? null,
      categories: baselineRelations.categories,
      permissions,
      isDirty,
      hasConcurrencyToken: Boolean(token),
      legalHoldAt: model.contentItem.legalHoldAt,
      retractedAt: model.contentItem.retractedAt,
      takedownAt: model.contentItem.takedownAt,
    }),
    [
      baselineRelations,
      focusedVersionId,
      isDirty,
      model.contentItem.draftVersionId,
      model.contentItem.id,
      model.contentItem.publicationStatus,
      model.contentItem.publishedVersionId,
      model.contentItem.scheduledAt,
      model.contentItem.scheduledVersionId,
      model.contentItem.legalHoldAt,
      model.contentItem.retractedAt,
      model.contentItem.takedownAt,
      model.draftVersion?.versionNumber,
      model.publishedVersion?.versionNumber,
      model.scheduledVersion?.versionNumber,
      permissions,
      token,
      version,
    ],
  );

  function patchField<K extends keyof ArticleEditorFields>(
    key: K,
    value: ArticleEditorFields[K],
  ) {
    if (!fields) {
      return;
    }
    setFields({ ...fields, [key]: value });
    setSaveState({ kind: "idle" });
  }

  async function save() {
    if (
      !version ||
      !fields ||
      !bodyDocument ||
      !canEdit ||
      !isDirty ||
      !validation.ok
    ) {
      return;
    }

    const nextBodyDocument = cloneBodyEditorDocument(bodyDocument);
    const nextRelations = cloneArticleEditorRelations(relations);
    const payload = {
      ...normalizeArticleEditorFields(fields),
      body: editorDocumentToBody(nextBodyDocument),
      versionId: version.id,
      expectedUpdatedAt: token,
      ...toDraftRelationPayload(nextRelations),
    };

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/content/${model.contentItem.id}/editor-fields`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json()) as {
        ok: boolean;
        data?: { updatedAt: string; fields: ArticleEditorFields };
        error?: { code: string; message: string };
      };

      if (!isSuccessfulSaveResponse({
        okHttp: response.ok,
        okBody: body.ok,
        hasData: Boolean(body.data),
      }) || !body.data) {
        const presented = presentSaveFailure(
          body.error?.code,
          body.error?.message,
        );
        setSaveState(presented);
        return;
      }

      setFields(body.data.fields);
      setBaseline(body.data.fields);
      setRelations(nextRelations);
      setBaselineRelations(nextRelations);
      setBodyDocument(nextBodyDocument);
      setBaselineBody(nextBodyDocument);
      setToken(body.data.updatedAt);
      setSaveState({ kind: "saved", message: "Taslak kaydedildi. Yayındaki sürüm değişmedi." });
      setHistoryRefreshKey((current) => current + 1);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  async function persistHeroMutation(nextHero: ArticleEditorMedia | null) {
    if (!version || !canEdit) {
      return;
    }

    setHeroBusy(true);
    try {
      const response = await fetch(`/api/content/${model.contentItem.id}/hero`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          expectedUpdatedAt: token,
          mediaId: nextHero?.id ?? null,
          altText: nextHero?.altText ?? null,
          credit: nextHero?.credit ?? null,
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: {
          updatedAt: string;
          hero: ArticleEditorMedia | null;
        };
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
        setSaveState(presentSaveFailure(body.error?.code, body.error?.message));
        return;
      }

      const persisted = body.data.hero
        ? {
            ...body.data.hero,
            role: "HERO" as const,
            sortOrder: body.data.hero.sortOrder ?? 0,
            caption: body.data.hero.caption ?? null,
          }
        : null;
      setRelations((current) => setHeroMedia(current, persisted));
      setBaselineRelations((current) => setHeroMedia(current, persisted));
      setToken(body.data.updatedAt);
      setSaveState({
        kind: "saved",
        message: persisted
          ? "Kapak görseli kaydedildi. Yayındaki sürüm değişmedi."
          : "Kapak görseli taslaktan kaldırıldı. Yayındaki sürüm değişmedi.",
      });
      setHistoryRefreshKey((current) => current + 1);
      router.refresh();
    } finally {
      setHeroBusy(false);
    }
  }

  async function persistGalleryMutation(nextGallery: ArticleEditorMedia[]) {
    if (!version || !canEdit) {
      return;
    }

    setGalleryBusy(true);
    try {
      const response = await fetch(`/api/content/${model.contentItem.id}/gallery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          expectedUpdatedAt: token,
          items: nextGallery.map((item) => ({
            mediaId: item.id,
            altText: item.altText ?? null,
            credit: item.credit ?? null,
            caption: item.caption ?? null,
          })),
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: {
          updatedAt: string;
          gallery: ArticleEditorMedia[];
        };
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
        setSaveState(presentSaveFailure(body.error?.code, body.error?.message));
        return;
      }

      const persisted = body.data.gallery.map((item, index) => ({
        ...item,
        role: "GALLERY" as const,
        sortOrder: item.sortOrder ?? index,
      }));
      setRelations((current) => setGalleryMedia(current, persisted));
      setBaselineRelations((current) => setGalleryMedia(current, persisted));
      setToken(body.data.updatedAt);
      setSaveState({
        kind: "saved",
        message:
          persisted.length > 0
            ? "Galeri kaydedildi. Yayındaki sürüm değişmedi."
            : "Galeri taslaktan kaldırıldı. Yayındaki sürüm değişmedi.",
      });
      setHistoryRefreshKey((current) => current + 1);
      router.refresh();
    } finally {
      setGalleryBusy(false);
    }
  }

  async function persistVideosMutation(nextVideos: ArticleEditorVideo[]) {
    if (!version || !canEdit) {
      return;
    }

    setVideoBusy(true);
    try {
      const response = await fetch(`/api/content/${model.contentItem.id}/videos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          expectedUpdatedAt: token,
          items: nextVideos.map((item) => ({
            videoAssetId: item.id,
            caption: item.caption ?? null,
          })),
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        data?: {
          updatedAt: string;
          videos: ArticleEditorVideo[];
        };
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
        setSaveState(presentSaveFailure(body.error?.code, body.error?.message));
        return;
      }

      const persisted = body.data.videos.map((item, index) => ({
        ...item,
        sortOrder: item.sortOrder ?? index,
      }));
      setRelations((current) => setArticleVideos(current, persisted));
      setBaselineRelations((current) => setArticleVideos(current, persisted));
      setToken(body.data.updatedAt);
      setSaveState({
        kind: "saved",
        message:
          persisted.length > 0
            ? "Videolar kaydedildi. Yayındaki sürüm değişmedi."
            : "Videolar taslaktan kaldırıldı. Yayındaki sürüm değişmedi.",
      });
      setHistoryRefreshKey((current) => current + 1);
      router.refresh();
    } finally {
      setVideoBusy(false);
    }
  }

  const backLabel = fromReview ? "İnceleme kuyruğuna dön" : "İçeriklere dön";
  const awaitingReview = version?.workflowStatus === "IN_REVIEW";

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 lg:py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={returnHref}
          className="rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          {backLabel}
        </Link>
        <p className="text-xs text-zinc-500" aria-live="polite">
          {isDirty ? "Kaydedilmemiş değişiklikler var" : "Kaydedildi"}
        </p>
      </div>

      {(fromReview || awaitingReview) && (
        <div
          role="status"
          className="mb-5 border-l-2 border-sky-600 bg-sky-50 px-3 py-2 text-sm text-sky-950"
        >
          {fromReview
            ? "Bu sürüm inceleme kuyruğundan açıldı. Açık sürüm değiştirilmedi."
            : "Bu sürüm inceleme bekliyor."}
        </div>
      )}

      <header className="border-b border-zinc-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">
              {fields?.title || version?.fields.title || model.contentItem.slug}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{model.contentItem.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">{PUBLICATION_AXIS_LABEL}</span>
            <StatusBadge
              label={PUBLICATION_STATUS_LABELS[model.contentItem.publicationStatus]}
              variant={status?.publicationVariant ?? "neutral"}
            />
            <span className="text-xs text-zinc-500">{WORKFLOW_AXIS_LABEL}</span>
            <StatusBadge
              label={
                version
                  ? WORKFLOW_STATUS_LABELS[version.workflowStatus]
                  : "—"
              }
              variant={status?.workflowVariant ?? "neutral"}
            />
            {status?.scheduledLabel && (
              <StatusBadge label={status.scheduledLabel} variant="info" />
            )}
          </div>
        </div>
      </header>

      {legalHoldActive ? (
        <div className="mt-4">
          <ArticleLegalHoldBanner message={LEGAL_HOLD_BLOCKED_COPY} />
        </div>
      ) : null}

      <div className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          {version && fields ? (
            <form
              className="space-y-8"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              {!canEdit && (
                <Notice>
                  {awaitingReview
                    ? "Bu sürüm incelemede olduğu için salt okunur."
                    : version && version.id !== model.contentItem.draftVersionId
                      ? "Açık sürüm güncel taslak değil. Alanlar salt okunur."
                      : "Bu sürüm şu anda düzenlenemez."}
                </Notice>
              )}

              <section className="space-y-4">
                <div>
                  <label
                    htmlFor="article-title"
                    className="mb-2 block text-sm font-medium text-zinc-700"
                  >
                    Başlık
                  </label>
                  <textarea
                    id="article-title"
                    rows={2}
                    value={fields.title}
                    disabled={!effectiveCanEdit}
                    aria-invalid={Boolean(validation.errors.title)}
                    aria-describedby={
                      validation.errors.title ? "article-title-error" : undefined
                    }
                    onChange={(event) => patchField("title", event.target.value)}
                    className="w-full resize-none rounded border border-zinc-300 bg-white px-3 py-3 text-2xl font-semibold leading-tight tracking-tight text-zinc-950 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
                  />
                  {validation.errors.title && (
                    <p id="article-title-error" className="mt-1 text-sm text-red-600">
                      {validation.errors.title}
                    </p>
                  )}
                </div>

                <TextField
                  id="article-subtitle"
                  label="Alt başlık"
                  value={fields.subtitle}
                  disabled={!effectiveCanEdit}
                  onChange={(value) => patchField("subtitle", value)}
                />

                <TextAreaField
                  id="article-excerpt"
                  label="Spot"
                  value={fields.excerpt}
                  disabled={!effectiveCanEdit}
                  rows={4}
                  onChange={(value) => patchField("excerpt", value)}
                />
              </section>

              <ArticleMetadataEditor
                relations={relations}
                disabled={!effectiveCanEdit}
                heroBusy={heroBusy}
                galleryBusy={galleryBusy}
                videoBusy={videoBusy}
                onChange={(next) => {
                  setRelations(next);
                  setSaveState({ kind: "idle" });
                }}
                onPersistHero={(media) => {
                  void persistHeroMutation(media);
                }}
                onRemoveHero={() => {
                  void persistHeroMutation(null);
                }}
                onPersistGallery={(gallery) => {
                  void persistGalleryMutation(gallery);
                }}
                onPersistVideos={(videos) => {
                  void persistVideosMutation(videos);
                }}
              />

              <section className="border-t border-zinc-200 pt-6">
                <h2 className="mb-4 text-sm font-semibold text-zinc-900">
                  Kaynak ve güvenilirlik
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="article-credibility"
                      className="mb-1 block text-sm font-medium text-zinc-700"
                    >
                      Doğruluk durumu
                    </label>
                    <select
                      id="article-credibility"
                      value={fields.credibility ?? ""}
                      disabled={!effectiveCanEdit}
                      onChange={(event) =>
                        patchField(
                          "credibility",
                          event.target.value ? (event.target.value as Credibility) : null,
                        )
                      }
                      className="h-9 w-full rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
                    >
                      <option value="">Belirtilmedi</option>
                      {Object.entries(CREDIBILITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <TextField
                    id="article-credibility-source"
                    label="Doğruluk kaynağı"
                    value={fields.credibilitySource}
                    disabled={!effectiveCanEdit}
                    onChange={(value) => patchField("credibilitySource", value)}
                  />
                  <TextField
                    id="article-source"
                    label="Kaynak"
                    value={fields.source}
                    disabled={!effectiveCanEdit}
                    onChange={(value) => patchField("source", value)}
                  />
                  <TextField
                    id="article-source-organization"
                    label="Kaynak kuruluş"
                    value={fields.sourceOrganization}
                    disabled={!effectiveCanEdit}
                    onChange={(value) => patchField("sourceOrganization", value)}
                  />
                  <TextField
                    id="article-source-url"
                    label="Kaynak URL"
                    value={fields.sourceUrl}
                    disabled={!effectiveCanEdit}
                    error={validation.errors.sourceUrl}
                    onChange={(value) => patchField("sourceUrl", value)}
                  />
                  <div className="flex items-center gap-5 pt-5">
                    <CheckboxField
                      id="article-syndicated"
                      label="Ajans / sendikasyon"
                      checked={fields.syndicated}
                      disabled={!effectiveCanEdit}
                      onChange={(value) => patchField("syndicated", value)}
                    />
                    <CheckboxField
                      id="article-material"
                      label="Materyal güncelleme"
                      checked={fields.isMaterialUpdate}
                      disabled={!effectiveCanEdit}
                      onChange={(value) => patchField("isMaterialUpdate", value)}
                    />
                  </div>
                </div>
              </section>

              <details className="border-t border-zinc-200 pt-6">
                <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
                  Gelişmiş / SEO
                </summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextField
                    id="article-seo-title"
                    label="SEO başlığı"
                    value={fields.seoTitle}
                    disabled={!effectiveCanEdit}
                    onChange={(value) => patchField("seoTitle", value)}
                  />
                  <TextField
                    id="article-canonical"
                    label="Canonical URL"
                    value={fields.canonicalUrl}
                    disabled={!effectiveCanEdit}
                    error={validation.errors.canonicalUrl}
                    onChange={(value) => patchField("canonicalUrl", value)}
                  />
                  <TextAreaField
                    id="article-seo-description"
                    label="SEO açıklaması"
                    value={fields.seoDescription}
                    disabled={!effectiveCanEdit}
                    rows={3}
                    onChange={(value) => patchField("seoDescription", value)}
                  />
                  <TextAreaField
                    id="article-robots"
                    label="Robots yönergesi"
                    value={fields.robots}
                    disabled={!effectiveCanEdit}
                    rows={3}
                    onChange={(value) => patchField("robots", value)}
                  />
                </div>
              </details>

              {bodyDocument ? (
                <StructuredBodyEditor
                  document={bodyDocument}
                  disabled={!effectiveCanEdit}
                  onChange={(next) => {
                    setBodyDocument(next);
                    setSaveState({ kind: "idle" });
                  }}
                />
              ) : (
                <Notice>
                  {bodyError ?? "Gövde bu editörde güvenli şekilde açılamıyor."}
                </Notice>
              )}

              <div className="sticky bottom-0 z-20 -mx-4 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SaveMessage state={saveState} isDirty={isDirty} />
                  <button
                    type="submit"
                    disabled={!canEdit || !isDirty || !validation.ok || isSaving || heroBusy || galleryBusy || videoBusy}
                    className="h-9 rounded bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {isSaving ? "Kaydediliyor..." : "Taslağı kaydet"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <Notice>
              Bu içerik için gösterilecek bir sürüm yok.
            </Notice>
          )}
        </main>

        <aside className="space-y-8 lg:border-l lg:border-zinc-200 lg:pl-6">
          <ArticleWorkflowPanel
            contentItemId={model.contentItem.id}
            eligibility={eligibility}
            expectedUpdatedAt={token}
            fromReview={fromReview}
            returnHref={returnHref}
            onConcurrencyToken={setToken}
            onHistoryRefresh={() =>
              setHistoryRefreshKey((current) => current + 1)
            }
          />

          <ArticleLegalPanel
            key={historyRefreshKey}
            contentItemId={model.contentItem.id}
            canLegal={permissions.canLegal}
            onConcurrencyToken={setToken}
            onHistoryRefresh={() =>
              setHistoryRefreshKey((current) => current + 1)
            }
          />

          <section>
            <h2 className="text-sm font-semibold text-zinc-900">Yayın ve iş akışı</h2>
            <dl className="mt-3 space-y-2">
              <Meta
                label="Yayın durumu"
                value={PUBLICATION_STATUS_LABELS[model.contentItem.publicationStatus]}
              />
              <Meta
                label="İş akışı"
                value={
                  version
                    ? WORKFLOW_STATUS_LABELS[version.workflowStatus]
                    : "—"
                }
              />
              <Meta
                label="Açık sürüm"
                value={version ? `Sürüm ${version.versionNumber}` : "Yok"}
              />
              <Meta
                label="Yayındaki sürüm"
                value={
                  model.publishedVersion
                    ? `Sürüm ${model.publishedVersion.versionNumber}`
                    : "Yok"
                }
              />
              <Meta
                label="Güncel taslak"
                value={
                  model.draftVersion
                    ? `Sürüm ${model.draftVersion.versionNumber}`
                    : "Yok"
                }
              />
              <Meta
                label="Zamanlanmış sürüm"
                value={
                  model.scheduledVersion
                    ? `Sürüm ${model.scheduledVersion.versionNumber}`
                    : "Yok"
                }
              />
              <Meta
                label="Yayın tarihi"
                value={formatDateTime(model.contentItem.publishedAt)}
              />
              <Meta
                label="Zamanlama"
                value={formatEditorialDateTime(model.contentItem.scheduledAt)}
              />
              <Meta
                label="Son güncelleme"
                value={formatDateTime(model.contentItem.updatedAt)}
              />
            </dl>
          </section>

          {version && (
            <section>
              <h2 className="text-sm font-semibold text-zinc-900">Künye</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Açık sürümün künyesi. Yayındaki sürüm ayrı durur.
              </p>
              <dl className="mt-3 space-y-2">
                <Meta
                  label="Ana kategori"
                  value={
                    relations.categories.find((item) => item.isPrimary)?.name ??
                    "Belirtilmedi"
                  }
                />
                <Meta
                  label="Yazar"
                  value={
                    relations.authors.length > 0
                      ? relations.authors
                          .map(
                            (item) =>
                              `${item.displayName} (${AUTHOR_ROLE_LABELS[item.role]})`,
                          )
                          .join(", ")
                      : "Belirtilmedi"
                  }
                />
              </dl>
            </section>
          )}

          <ArticleRevisionPanel
            contentItemId={model.contentItem.id}
            focusedVersionId={focusedVersionId ?? version?.id ?? null}
            initialVersions={revisions.versions}
            nextCursor={revisions.nextCursor}
          />

          <div aria-label={permissions.canReview ? "İnceleme paneli" : "İnceleme geçmişi"}>
            <ArticleReviewPanel
              events={reviewEvents}
              awaitingReview={Boolean(awaitingReview)}
            />
          </div>

          <section>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Kayıt akışı</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Kaydetme ve yayın işlemlerinin kaydı.
                </p>
              </div>
              <button
                type="button"
                aria-expanded={isHistoryOpen}
                aria-controls="article-audit-history-panel"
                onClick={() => setIsHistoryOpen((current) => !current)}
                className="rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                {isHistoryOpen ? "Kapat" : "Aç"}
              </button>
            </div>
            {isHistoryOpen && (
              <div id="article-audit-history-panel" className="mt-3">
                <ArticleAuditHistory
                  contentItemId={model.contentItem.id}
                  isOpen={isHistoryOpen}
                  refreshKey={historyRefreshKey}
                />
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  disabled,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  rows,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string | null;
  rows: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-zinc-700">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full resize-y rounded border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
      />
    </div>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-zinc-700">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
      />
      {label}
    </label>
  );
}

function SaveMessage({ state, isDirty }: { state: SaveState; isDirty: boolean }) {
  if (state.kind === "conflict") {
    return <p className="text-sm font-medium text-red-700">{state.message}</p>;
  }
  if (state.kind === "error") {
    return <p className="text-sm font-medium text-red-700">{state.message}</p>;
  }
  if (state.kind === "saved") {
    return <p className="text-sm text-emerald-700">{state.message}</p>;
  }
  return (
    <p className="text-sm text-zinc-600">
      {isDirty ? "Değişiklikler kaydedilmedi." : "Kaydedildi."}
    </p>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="border-l-2 border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-950">
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-medium text-zinc-800">{value}</dd>
    </div>
  );
}

export { ArticleEditor as ArticleWorkspace };
