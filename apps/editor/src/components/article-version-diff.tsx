"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateTime } from "@/lib/content/format-date";
import {
  formatRevisionLabel,
  primaryVersionRoleLabel,
  WORKFLOW_STATUS_LABELS,
} from "@/lib/content/revision-presentation";
import {
  authorRoleDiffLabel,
  changeTypeLabel,
  entityRoleLabel,
  fieldGroup,
  fieldLabel,
  formatBooleanDiff,
  mediaRoleLabel,
  DIFF_FIELD_GROUP,
} from "@/lib/content/diff-presentation";
import type { WorkflowStatus } from "@magazine/domain";

type DiffVersion = {
  id: string;
  versionNumber: number;
  workflowStatus: WorkflowStatus | string;
  createdAt: string;
  isCurrentDraft: boolean;
  isPublishedVersion: boolean;
  isScheduledVersion: boolean;
};

type FieldDiff = {
  field: string;
  changeType: "ADDED" | "REMOVED" | "MODIFIED";
  before: string | boolean | null;
  after: string | boolean | null;
};

type LabelRef = { id: string; label: string; slug?: string };

type DiffResponse = {
  fromVersion: DiffVersion;
  toVersion: DiffVersion;
  summary: {
    changed: boolean;
    scalarFieldsChanged: number;
    blocksAdded: number;
    blocksRemoved: number;
    blocksModified: number;
    blocksMoved: number;
    bodyDetailLimited: boolean;
    categoriesAdded: number;
    categoriesRemoved: number;
    primaryCategoryChanged: boolean;
    tagsAdded: number;
    tagsRemoved: number;
    entitiesChanged: boolean;
    mediaChanged: boolean;
    videosChanged?: boolean;
    authorsChanged: boolean;
  };
  fields: FieldDiff[];
  body: {
    changed: boolean;
    detailLimited: boolean;
    blocks: {
      changeType: "ADDED" | "REMOVED" | "MODIFIED" | "MOVED";
      blockType: string;
      beforeText: string | null;
      afterText: string | null;
      inlineChanges?: { type: "EQUAL" | "ADDED" | "REMOVED"; text: string }[];
    }[];
  };
  relations: {
    categories: {
      primary: { before: LabelRef | null; after: LabelRef | null; changed: boolean };
      added: LabelRef[];
      removed: LabelRef[];
    };
    tags: { added: LabelRef[]; removed: LabelRef[] };
    entities: {
      added: (LabelRef & { role: string; kind?: string })[];
      removed: (LabelRef & { role: string; kind?: string })[];
      modified: { id: string; label: string; beforeRole: string; afterRole: string }[];
    };
    media: {
      added: (LabelRef & { role: string })[];
      removed: (LabelRef & { role: string })[];
      modified: {
        id: string;
        label: string;
        before: { role: string; caption: string | null };
        after: { role: string; caption: string | null };
      }[];
    };
    videos: {
      added: (LabelRef & { provider: string; durationSeconds: number | null })[];
      removed: (LabelRef & { provider: string; durationSeconds: number | null })[];
      modified: {
        id: string;
        label: string;
        before: { caption: string | null };
        after: { caption: string | null };
      }[];
    };
    authors: {
      added: (LabelRef & { role: string })[];
      removed: (LabelRef & { role: string })[];
      modified: { id: string; label: string; beforeRole: string; afterRole: string }[];
    };
  };
};

type Props = {
  contentItemId: string;
  fromVersionId: string;
  toVersionId: string;
  onClose: () => void;
};

const TAB = {
  ALL: "ALL",
  CONTENT: "CONTENT",
  CLASSIFICATION: "CLASSIFICATION",
  ENTITIES: "ENTITIES",
  MEDIA: "MEDIA",
  SEO: "SEO",
  SOURCE: "SOURCE",
} as const;
type Tab = (typeof TAB)[keyof typeof TAB];

const TAB_LABEL: Record<Tab, string> = {
  ALL: "Tüm Değişiklikler",
  CONTENT: "İçerik",
  CLASSIFICATION: "Sınıflandırma",
  ENTITIES: "Varlıklar",
  MEDIA: "Medya",
  SEO: "SEO",
  SOURCE: "Kaynak / Güvenilirlik",
};

const BODY_BLOCK_PAGE = 12;

export function ArticleVersionDiff({
  contentItemId,
  fromVersionId,
  toVersionId,
  onClose,
}: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [diff, setDiff] = useState<DiffResponse | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ fromVersionId, toVersionId });
    void fetch(`/api/content/${contentItemId}/diff?${params.toString()}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as { ok: boolean; data?: DiffResponse };
        if (!response.ok || !body.ok || !body.data) {
          throw new Error("failed");
        }
        if (active) {
          setDiff(serializeDiffDates(body.data));
          setState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [contentItemId, fromVersionId, toVersionId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sürüm karşılaştırma"
        className="w-full max-w-4xl rounded border border-zinc-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Sürüm Karşılaştırma</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Kapat
          </button>
        </div>

        {state === "loading" && (
          <p role="status" className="px-5 py-10 text-center text-sm text-zinc-500">
            Farklar hazırlanıyor…
          </p>
        )}

        {state === "error" && (
          <p role="alert" className="px-5 py-10 text-center text-sm text-red-700">
            Sürümler karşılaştırılamadı.
          </p>
        )}

        {state === "ready" && diff && <DiffBody diff={diff} />}
      </div>
    </div>
  );
}

function workflowLabel(status: string): string {
  return WORKFLOW_STATUS_LABELS[status as WorkflowStatus] ?? status;
}

function VersionBadge({ version, tone }: { version: DiffVersion; tone: "old" | "new" }) {
  return (
    <div className="min-w-0 flex-1">
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          tone === "old" ? "text-zinc-500" : "text-pink-600"
        }`}
      >
        {primaryVersionRoleLabel(version)}
      </p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900">
        {formatRevisionLabel(version.versionNumber)}
      </p>
      <p className="mt-0.5 text-xs text-zinc-500">
        {workflowLabel(String(version.workflowStatus))} ·{" "}
        <time dateTime={version.createdAt}>{formatDateTime(version.createdAt)}</time>
      </p>
    </div>
  );
}

function countChanges(diff: DiffResponse) {
  const r = diff.relations;
  const added =
    diff.body.blocks.filter((b) => b.changeType === "ADDED").length +
    r.categories.added.length +
    r.tags.added.length +
    r.entities.added.length +
    r.media.added.length +
    r.videos.added.length +
    r.authors.added.length;
  const removed =
    diff.body.blocks.filter((b) => b.changeType === "REMOVED").length +
    r.categories.removed.length +
    r.tags.removed.length +
    r.entities.removed.length +
    r.media.removed.length +
    r.videos.removed.length +
    r.authors.removed.length;
  const changed =
    diff.fields.length +
    diff.body.blocks.filter((b) => b.changeType === "MODIFIED" || b.changeType === "MOVED")
      .length +
    (r.categories.primary.changed ? 1 : 0) +
    r.entities.modified.length +
    r.media.modified.length +
    r.videos.modified.length +
    r.authors.modified.length;
  return { added, changed, removed };
}

function availableTabs(diff: DiffResponse): Tab[] {
  const tabs: Tab[] = [TAB.ALL];
  const contentFields = diff.fields.some((f) => fieldGroup(f.field) === DIFF_FIELD_GROUP.CONTENT);
  const seoFields = diff.fields.some((f) => fieldGroup(f.field) === DIFF_FIELD_GROUP.SEO);
  const sourceFields = diff.fields.some((f) => fieldGroup(f.field) === DIFF_FIELD_GROUP.SOURCE);
  if (contentFields || diff.body.changed) tabs.push(TAB.CONTENT);
  const classificationChanged =
    diff.relations.categories.primary.changed ||
    diff.relations.categories.added.length > 0 ||
    diff.relations.categories.removed.length > 0 ||
    diff.relations.tags.added.length > 0 ||
    diff.relations.tags.removed.length > 0 ||
    diff.summary.authorsChanged;
  if (classificationChanged) tabs.push(TAB.CLASSIFICATION);
  if (diff.summary.entitiesChanged) tabs.push(TAB.ENTITIES);
  if (diff.summary.mediaChanged || diff.summary.videosChanged) tabs.push(TAB.MEDIA);
  if (seoFields) tabs.push(TAB.SEO);
  if (sourceFields) tabs.push(TAB.SOURCE);
  return tabs;
}

function DiffBody({ diff }: { diff: DiffResponse }) {
  const tabs = useMemo(() => availableTabs(diff), [diff]);
  const [activeTab, setActiveTab] = useState<Tab>(TAB.ALL);
  const tab = tabs.includes(activeTab) ? activeTab : TAB.ALL;
  const counts = useMemo(() => countChanges(diff), [diff]);

  const showContent = tab === TAB.ALL || tab === TAB.CONTENT;
  const showClassification = tab === TAB.ALL || tab === TAB.CLASSIFICATION;
  const showEntities = tab === TAB.ALL || tab === TAB.ENTITIES;
  const showMedia = tab === TAB.ALL || tab === TAB.MEDIA;
  const showSeo = tab === TAB.ALL || tab === TAB.SEO;
  const showSource = tab === TAB.ALL || tab === TAB.SOURCE;

  if (!diff.summary.changed) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-zinc-500">Bu iki sürüm arasında görünür bir fark yok.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <VersionBadge version={diff.fromVersion} tone="old" />
          <span aria-hidden className="hidden text-zinc-300 sm:block">
            →
          </span>
          <VersionBadge version={diff.toVersion} tone="new" />
        </div>
        <div className="flex shrink-0 gap-3 text-xs font-medium">
          {counts.added > 0 && (
            <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">
              {counts.added} ekleme
            </span>
          )}
          {counts.changed > 0 && (
            <span className="rounded bg-amber-50 px-2 py-1 text-amber-800">
              {counts.changed} değişiklik
            </span>
          )}
          {counts.removed > 0 && (
            <span className="rounded bg-red-50 px-2 py-1 text-red-700">
              {counts.removed} kaldırma
            </span>
          )}
        </div>
      </div>

      {tabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Değişiklik alanları"
          className="flex flex-wrap gap-1 border-b border-zinc-200 px-5 py-2"
        >
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setActiveTab(id)}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                tab === id ? "bg-pink-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {TAB_LABEL[id]}
            </button>
          ))}
        </div>
      )}

      <div className="max-h-[65vh] space-y-6 overflow-y-auto px-5 py-4">
        {showContent && <ContentSection diff={diff} />}
        {showClassification && <ClassificationSection diff={diff} />}
        {showEntities && <EntitiesSection diff={diff} />}
        {showMedia && <MediaSection diff={diff} />}
        {showSeo && <ScalarGroupSection diff={diff} group={DIFF_FIELD_GROUP.SEO} title="SEO" />}
        {showSource && (
          <ScalarGroupSection
            diff={diff}
            group={DIFF_FIELD_GROUP.SOURCE}
            title="Kaynak / Güvenilirlik"
          />
        )}
      </div>
    </div>
  );
}

function ScalarField({ field }: { field: FieldDiff }) {
  return (
    <li>
      <p className="text-xs font-medium text-zinc-500">
        {fieldLabel(field.field)} · {changeTypeLabel(field.changeType)}
      </p>
      <div className="mt-1 space-y-1 text-sm">
        {field.changeType !== "ADDED" && (
          <p className="rounded bg-red-50 px-2 py-1 text-red-900 line-through decoration-red-400">
            {formatBooleanDiff(field.before)}
          </p>
        )}
        {field.changeType !== "REMOVED" && (
          <p className="rounded bg-emerald-50 px-2 py-1 text-emerald-900">
            {formatBooleanDiff(field.after)}
          </p>
        )}
      </div>
    </li>
  );
}

function ScalarGroupSection({
  diff,
  group,
  title,
}: {
  diff: DiffResponse;
  group: ReturnType<typeof fieldGroup>;
  title: string;
}) {
  const fields = diff.fields.filter((f) => fieldGroup(f.field) === group);
  if (fields.length === 0) {
    return null;
  }
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="mt-2 space-y-3">
        {fields.map((field) => (
          <ScalarField key={field.field} field={field} />
        ))}
      </ul>
    </section>
  );
}

function ContentSection({ diff }: { diff: DiffResponse }) {
  const [showAllBlocks, setShowAllBlocks] = useState(false);
  const contentFields = diff.fields.filter(
    (f) => fieldGroup(f.field) === DIFF_FIELD_GROUP.CONTENT,
  );
  const blocks = diff.body.blocks.filter(
    (block) => block.changeType !== "MOVED" || block.beforeText || block.afterText,
  );
  const visibleBlocks = showAllBlocks ? blocks : blocks.slice(0, BODY_BLOCK_PAGE);

  if (contentFields.length === 0 && !diff.body.changed) {
    return null;
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">İçerik</h3>
      {contentFields.length > 0 && (
        <ul className="mt-2 space-y-3">
          {contentFields.map((field) => (
            <ScalarField key={field.field} field={field} />
          ))}
        </ul>
      )}

      {diff.body.changed && (
        <div className={contentFields.length > 0 ? "mt-4" : "mt-2"}>
          <p className="text-xs font-medium text-zinc-500">Metin</p>
          <ul className="mt-2 space-y-2">
            {visibleBlocks.map((block, index) => (
              <li key={`${block.blockType}-${index}`} className="text-sm">
                <p className="text-[11px] font-medium text-zinc-400">
                  {changeTypeLabel(block.changeType)}
                </p>
                {block.inlineChanges && block.inlineChanges.length > 0 ? (
                  <p className="mt-1 leading-relaxed text-zinc-800">
                    {block.inlineChanges.map((part, partIndex) => (
                      <span
                        key={partIndex}
                        className={
                          part.type === "ADDED"
                            ? "bg-emerald-50 text-emerald-900"
                            : part.type === "REMOVED"
                              ? "bg-red-50 text-red-800 line-through decoration-red-400"
                              : ""
                        }
                      >
                        {part.text}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p
                    className={`mt-1 rounded px-2 py-1 leading-relaxed ${
                      block.changeType === "ADDED"
                        ? "bg-emerald-50 text-emerald-900"
                        : block.changeType === "REMOVED"
                          ? "bg-red-50 text-red-900"
                          : "text-zinc-700"
                    }`}
                  >
                    {block.afterText || block.beforeText || "Blok değişti."}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {blocks.length > BODY_BLOCK_PAGE && (
            <button
              type="button"
              onClick={() => setShowAllBlocks((value) => !value)}
              className="mt-2 text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
            >
              {showAllBlocks
                ? "Daha az göster"
                : `Tüm ${blocks.length} değişikliği göster`}
            </button>
          )}
          {diff.body.detailLimited && (
            <p className="mt-2 text-xs text-zinc-500">
              Uzun metin karşılaştırması kısaltıldı.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function RelationLine({
  kind,
  label,
}: {
  kind: "added" | "removed";
  label: string;
}) {
  return (
    <li
      className={`rounded px-2 py-1 text-sm ${
        kind === "added" ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"
      }`}
    >
      {kind === "added" ? "+ " : "− "}
      {label}
    </li>
  );
}

function ClassificationSection({ diff }: { diff: DiffResponse }) {
  const { categories, tags, authors } = diff.relations;
  const hasCategoryChange =
    categories.primary.changed || categories.added.length > 0 || categories.removed.length > 0;
  const hasTagChange = tags.added.length > 0 || tags.removed.length > 0;
  const hasAuthorChange = diff.summary.authorsChanged;

  if (!hasCategoryChange && !hasTagChange && !hasAuthorChange) {
    return null;
  }

  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Sınıflandırma
      </h3>
      <div className="mt-2 space-y-4">
        {hasCategoryChange && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Kategori</p>
            {categories.primary.changed && (
              <p className="mt-1 text-sm text-zinc-800">
                Eski: {categories.primary.before?.label ?? "—"}
                <br />
                Yeni: {categories.primary.after?.label ?? "—"}
              </p>
            )}
            {(categories.added.length > 0 || categories.removed.length > 0) && (
              <ul className="mt-1 space-y-1">
                {categories.added.map((item) => (
                  <RelationLine key={`cat-add-${item.id}`} kind="added" label={item.label} />
                ))}
                {categories.removed.map((item) => (
                  <RelationLine key={`cat-rem-${item.id}`} kind="removed" label={item.label} />
                ))}
              </ul>
            )}
          </div>
        )}

        {hasTagChange && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Etiketler</p>
            <ul className="mt-1 space-y-1">
              {tags.added.map((item) => (
                <RelationLine key={`tag-add-${item.id}`} kind="added" label={item.label} />
              ))}
              {tags.removed.map((item) => (
                <RelationLine key={`tag-rem-${item.id}`} kind="removed" label={item.label} />
              ))}
            </ul>
          </div>
        )}

        {hasAuthorChange && (
          <div>
            <p className="text-xs font-medium text-zinc-500">Yazarlar</p>
            <ul className="mt-1 space-y-1">
              {authors.added.map((item) => (
                <RelationLine
                  key={`auth-add-${item.id}`}
                  kind="added"
                  label={`${item.label} (${authorRoleDiffLabel(item.role)})`}
                />
              ))}
              {authors.removed.map((item) => (
                <RelationLine
                  key={`auth-rem-${item.id}`}
                  kind="removed"
                  label={`${item.label} (${authorRoleDiffLabel(item.role)})`}
                />
              ))}
              {authors.modified.map((item) => (
                <li key={`auth-mod-${item.id}`} className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">
                  {item.label}: {authorRoleDiffLabel(item.beforeRole)} →{" "}
                  {authorRoleDiffLabel(item.afterRole)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function EntitiesSection({ diff }: { diff: DiffResponse }) {
  const { entities } = diff.relations;
  if (!diff.summary.entitiesChanged) {
    return null;
  }
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Varlıklar</h3>
      <ul className="mt-2 space-y-1">
        {entities.added.map((item) => (
          <RelationLine
            key={`ent-add-${item.id}`}
            kind="added"
            label={`${item.label} · ${entityRoleLabel(item.role)}`}
          />
        ))}
        {entities.removed.map((item) => (
          <RelationLine
            key={`ent-rem-${item.id}`}
            kind="removed"
            label={`${item.label} · ${entityRoleLabel(item.role)}`}
          />
        ))}
        {entities.modified.map((item) => (
          <li
            key={`ent-mod-${item.id}`}
            className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-900"
          >
            {item.label}: {entityRoleLabel(item.beforeRole)} → {entityRoleLabel(item.afterRole)}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return ` · ${minutes}:${String(remainder).padStart(2, "0")}`;
}

function MediaSection({ diff }: { diff: DiffResponse }) {
  const { media, videos } = diff.relations;
  if (!diff.summary.mediaChanged && !diff.summary.videosChanged) {
    return null;
  }
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Medya</h3>
      {diff.summary.mediaChanged && (
        <ul className="mt-2 space-y-1">
          {media.added.map((item) => (
            <RelationLine
              key={`media-add-${item.id}`}
              kind="added"
              label={`${item.label} · ${mediaRoleLabel(item.role)}`}
            />
          ))}
          {media.removed.map((item) => (
            <RelationLine
              key={`media-rem-${item.id}`}
              kind="removed"
              label={`${item.label} · ${mediaRoleLabel(item.role)}`}
            />
          ))}
          {media.modified.map((item) => (
            <li
              key={`media-mod-${item.id}`}
              className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-900"
            >
              {item.label} güncellendi
              {item.before.role !== item.after.role
                ? ` · ${mediaRoleLabel(item.before.role)} → ${mediaRoleLabel(item.after.role)}`
                : ""}
            </li>
          ))}
        </ul>
      )}
      {diff.summary.videosChanged && (
        <ul className="mt-2 space-y-1">
          {videos.added.map((item) => (
            <RelationLine
              key={`video-add-${item.id}`}
              kind="added"
              label={`${item.label}${formatDuration(item.durationSeconds)}`}
            />
          ))}
          {videos.removed.map((item) => (
            <RelationLine
              key={`video-rem-${item.id}`}
              kind="removed"
              label={`${item.label}${formatDuration(item.durationSeconds)}`}
            />
          ))}
          {videos.modified.map((item) => (
            <li
              key={`video-mod-${item.id}`}
              className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-900"
            >
              {item.label}: video açıklaması değişti
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function serializeDiffDates(diff: DiffResponse): DiffResponse {
  return {
    ...diff,
    fromVersion: {
      ...diff.fromVersion,
      createdAt:
        typeof diff.fromVersion.createdAt === "string"
          ? diff.fromVersion.createdAt
          : new Date(diff.fromVersion.createdAt).toISOString(),
    },
    toVersion: {
      ...diff.toVersion,
      createdAt:
        typeof diff.toVersion.createdAt === "string"
          ? diff.toVersion.createdAt
          : new Date(diff.toVersion.createdAt).toISOString(),
    },
  };
}
