"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Credibility } from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import { deriveContentStatus } from "@/lib/content/status";
import { ArticleAuditHistory } from "@/components/article-audit-history";
import { StructuredBodyEditor } from "@/components/structured-body-editor";
import {
  bodyEditorDocumentsEqual,
  bodyToEditorDocument,
  cloneBodyEditorDocument,
  editorDocumentToBody,
  type BodyEditorDocument,
} from "@/lib/content/body-editor-state";
import {
  CREDIBILITY_LABELS,
  articleEditorFieldsEqual,
  normalizeArticleEditorFields,
  validateArticleEditorFields,
  type ArticleEditorFields,
} from "@/lib/content/article-editor-state";

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
      categories: { id: string; name: string; slug: string; isPrimary: boolean }[];
      authors: { id: string; displayName: string; slug: string }[];
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
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saved"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

const WORKFLOW_LABELS = {
  DRAFT: "Taslak",
  IN_REVIEW: "İncelemede",
  APPROVED: "Onaylandı",
} as const;

const PUBLICATION_LABELS = {
  NEVER_PUBLISHED: "Yayınlanmamış",
  PUBLISHED: "Yayında",
  UNPUBLISHED: "Kaldırıldı",
} as const;

export function ArticleEditor({ model, returnHref }: Props) {
  const version = model.editableVersion;
  const [baseline, setBaseline] = useState<ArticleEditorFields | null>(
    version?.fields ?? null,
  );
  const [fields, setFields] = useState<ArticleEditorFields | null>(
    version?.fields ?? null,
  );
  const bodyParse = useMemo(
    () => (version ? bodyToEditorDocument(version.body) : null),
    [version],
  );
  const [baselineBody, setBaselineBody] = useState<BodyEditorDocument | null>(
    bodyParse?.ok ? cloneBodyEditorDocument(bodyParse.document) : null,
  );
  const [bodyDocument, setBodyDocument] = useState<BodyEditorDocument | null>(
    bodyParse?.ok ? cloneBodyEditorDocument(bodyParse.document) : null,
  );
  const [token, setToken] = useState(version?.concurrencyToken ?? "");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [isSaving, setIsSaving] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const validation = useMemo(
    () => (fields ? validateArticleEditorFields(fields) : { ok: true, errors: {} }),
    [fields],
  );
  const isDirty = Boolean(
    fields &&
      baseline &&
      ((!articleEditorFieldsEqual(fields, baseline)) ||
        (bodyDocument &&
          baselineBody &&
          !bodyEditorDocumentsEqual(bodyDocument, baselineBody))),
  );
  const canEdit = Boolean(
    version?.canEdit && fields && baseline && bodyDocument && baselineBody,
  );

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
    const payload = {
      ...normalizeArticleEditorFields(fields),
      body: editorDocumentToBody(nextBodyDocument),
      versionId: version.id,
      expectedUpdatedAt: token,
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

      if (!response.ok || !body.ok || !body.data) {
        const code = body.error?.code;
        setSaveState({
          kind: code === "CONTENT_WRITE_CONFLICT" ? "conflict" : "error",
          message:
            code === "CONTENT_WRITE_CONFLICT"
              ? "Bu içerik başka bir oturumda güncellendi. Değişikliklerin kaybolmadı; sayfayı yenileyip son sürümle karşılaştırman gerekiyor."
              : (body.error?.message ?? "Kayıt sırasında beklenmeyen bir hata oluştu."),
        });
        return;
      }

      setFields(body.data.fields);
      setBaseline(body.data.fields);
      setBodyDocument(cloneBodyEditorDocument(nextBodyDocument));
      setBaselineBody(cloneBodyEditorDocument(nextBodyDocument));
      setToken(body.data.updatedAt);
      setSaveState({ kind: "saved", message: "Değişiklikler kaydedildi." });
      setHistoryRefreshKey((current) => current + 1);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 lg:py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={returnHref}
          className="rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          İçeriklere dön
        </Link>
        <div className="text-xs text-zinc-500">
          {isDirty ? "Kaydedilmemiş değişiklikler var" : "Kaydedildi"}
        </div>
      </div>

      <header className="border-b border-zinc-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              Article Editor
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950 md:text-3xl">
              {fields?.title || version?.fields.title || model.contentItem.slug}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">{model.contentItem.slug}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge label={PUBLICATION_LABELS[model.contentItem.publicationStatus]} />
            {status && <Badge label={status.workflowLabel} />}
            {status?.scheduledLabel && <Badge label={status.scheduledLabel} />}
          </div>
        </div>
      </header>

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
                  Bu sürüm şu anda düzenlenemez. Scalar düzenleme yalnızca DRAFT
                  durumundaki mevcut taslak sürüm için açıktır.
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
                    disabled={!canEdit}
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
                  disabled={!canEdit}
                  onChange={(value) => patchField("subtitle", value)}
                />

                <TextAreaField
                  id="article-excerpt"
                  label="Spot"
                  value={fields.excerpt}
                  disabled={!canEdit}
                  rows={4}
                  onChange={(value) => patchField("excerpt", value)}
                />
              </section>

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
                      disabled={!canEdit}
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
                    disabled={!canEdit}
                    onChange={(value) => patchField("credibilitySource", value)}
                  />
                  <TextField
                    id="article-source"
                    label="Kaynak"
                    value={fields.source}
                    disabled={!canEdit}
                    onChange={(value) => patchField("source", value)}
                  />
                  <TextField
                    id="article-source-organization"
                    label="Kaynak kuruluş"
                    value={fields.sourceOrganization}
                    disabled={!canEdit}
                    onChange={(value) => patchField("sourceOrganization", value)}
                  />
                  <TextField
                    id="article-source-url"
                    label="Kaynak URL"
                    value={fields.sourceUrl}
                    disabled={!canEdit}
                    error={validation.errors.sourceUrl}
                    onChange={(value) => patchField("sourceUrl", value)}
                  />
                  <div className="flex items-center gap-5 pt-5">
                    <CheckboxField
                      id="article-syndicated"
                      label="Ajans / sendikasyon"
                      checked={fields.syndicated}
                      disabled={!canEdit}
                      onChange={(value) => patchField("syndicated", value)}
                    />
                    <CheckboxField
                      id="article-material"
                      label="Materyal güncelleme"
                      checked={fields.isMaterialUpdate}
                      disabled={!canEdit}
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
                    disabled={!canEdit}
                    onChange={(value) => patchField("seoTitle", value)}
                  />
                  <TextField
                    id="article-canonical"
                    label="Canonical URL"
                    value={fields.canonicalUrl}
                    disabled={!canEdit}
                    error={validation.errors.canonicalUrl}
                    onChange={(value) => patchField("canonicalUrl", value)}
                  />
                  <TextAreaField
                    id="article-seo-description"
                    label="SEO açıklaması"
                    value={fields.seoDescription}
                    disabled={!canEdit}
                    rows={3}
                    onChange={(value) => patchField("seoDescription", value)}
                  />
                  <TextAreaField
                    id="article-robots"
                    label="Robots yönergesi"
                    value={fields.robots}
                    disabled={!canEdit}
                    rows={3}
                    onChange={(value) => patchField("robots", value)}
                  />
                </div>
              </details>

              {bodyParse?.ok && bodyDocument ? (
                <StructuredBodyEditor
                  document={bodyDocument}
                  disabled={!canEdit}
                  onChange={(next) => {
                    setBodyDocument(next);
                    setSaveState({ kind: "idle" });
                  }}
                />
              ) : (
                <Notice>
                  {bodyParse && !bodyParse.ok
                    ? bodyParse.message
                    : "Gövde bu editörde güvenli şekilde açılamıyor."}
                </Notice>
              )}

              <div className="sticky bottom-0 z-20 -mx-4 border-t border-zinc-200 bg-zinc-50/95 px-4 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SaveMessage state={saveState} isDirty={isDirty} />
                  <button
                    type="submit"
                    disabled={!canEdit || !isDirty || !validation.ok || isSaving}
                    className="h-9 rounded bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
                  >
                    {isSaving ? "Kaydediliyor..." : "Kaydet"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <Notice>
              Bu içerik için mevcut bir taslak sürüm yok. Yayındaki sürümü
              doğrudan düzenlemek bu geçişte desteklenmiyor.
            </Notice>
          )}
        </main>

        <aside className="space-y-4">
          <section>
            <div className="flex items-start justify-between gap-3 rounded border border-zinc-200 bg-white p-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">Geçmiş</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  İçerik için kayıtlı audit akışı.
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

          <Panel title="Sürüm bağlamı">
            <Meta label="Düzenlenen sürüm" value={version ? `v${version.versionNumber}` : "Yok"} />
            <Meta label="İş akışı" value={version ? WORKFLOW_LABELS[version.workflowStatus] : "—"} />
            <Meta
              label="Yayındaki sürüm"
              value={
                model.publishedVersion
                  ? `v${model.publishedVersion.versionNumber}`
                  : "Yok"
              }
            />
            <Meta
              label="Zamanlanmış sürüm"
              value={
                model.scheduledVersion
                  ? `v${model.scheduledVersion.versionNumber}`
                  : "Yok"
              }
            />
            <Meta label="Son güncelleme" value={formatDateTime(model.contentItem.updatedAt)} />
          </Panel>

          <Panel title="Yayın durumu">
            <Meta
              label="Yayın"
              value={PUBLICATION_LABELS[model.contentItem.publicationStatus]}
            />
            <Meta label="Yayın tarihi" value={formatDateTime(model.contentItem.publishedAt)} />
            <Meta label="Zamanlama" value={formatDateTime(model.contentItem.scheduledAt)} />
          </Panel>

          {version && (
            <Panel title="İlişkiler">
              <Meta
                label="Kategori"
                value={
                  version.relations.categories.find((item) => item.isPrimary)?.name ??
                  "Belirtilmedi"
                }
              />
              <Meta
                label="Yazar"
                value={
                  version.relations.authors.length > 0
                    ? version.relations.authors.map((item) => item.displayName).join(", ")
                    : "Belirtilmedi"
                }
              />
            </Panel>
          )}
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

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
      {label}
    </span>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {children}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
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
