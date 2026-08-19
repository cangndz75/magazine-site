"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/content/format-date";
import { formatRevisionLabel, WORKFLOW_STATUS_LABELS } from "@/lib/content/revision-presentation";
import {
  changeTypeLabel,
  fieldLabel,
  formatBooleanDiff,
  presentDiffSummary,
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
    authorsChanged: boolean;
  };
  fields: {
    field: string;
    changeType: "ADDED" | "REMOVED" | "MODIFIED";
    before: string | boolean | null;
    after: string | boolean | null;
  }[];
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
      primary: {
        before: { label: string } | null;
        after: { label: string } | null;
        changed: boolean;
      };
      added: { label: string }[];
      removed: { label: string }[];
    };
    tags: { added: { label: string }[]; removed: { label: string }[] };
    entities: {
      added: { label: string; kind?: string }[];
      removed: { label: string; kind?: string }[];
      modified: { label: string; beforeRole: string; afterRole: string }[];
    };
    media: {
      added: { label: string }[];
      removed: { label: string }[];
      modified: { label: string }[];
    };
    authors: {
      added: { label: string; role: string }[];
      removed: { label: string; role: string }[];
      modified: { label: string; beforeRole: string; afterRole: string }[];
    };
  };
};

type Props = {
  contentItemId: string;
  fromVersionId: string;
  toVersionId: string;
  onClose: () => void;
};

export function ArticleVersionDiff({
  contentItemId,
  fromVersionId,
  toVersionId,
  onClose,
}: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [diff, setDiff] = useState<DiffResponse | null>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ fromVersionId, toVersionId });
    void fetch(`/api/content/${contentItemId}/diff?${params.toString()}`, {
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok: boolean;
          data?: DiffResponse;
        };
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

  return (
    <div className="mt-4 border-t border-zinc-200 pt-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900">Sürüm farkı</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          Kapat
        </button>
      </div>

      {state === "loading" && (
        <p role="status" className="mt-3 text-sm text-zinc-500">
          Farklar hazırlanıyor…
        </p>
      )}

      {state === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Sürümler karşılaştırılamadı.
        </p>
      )}

      {state === "ready" && diff && <DiffBody diff={diff} />}
    </div>
  );
}

function DiffBody({ diff }: { diff: DiffResponse }) {
  const summary = presentDiffSummary(diff.summary);
  const workflow = (status: string) =>
    WORKFLOW_STATUS_LABELS[status as WorkflowStatus] ?? status;

  return (
    <div className="mt-3 space-y-4">
      <p className="text-xs text-zinc-500">
        {formatRevisionLabel(diff.fromVersion.versionNumber)}
        {" → "}
        {formatRevisionLabel(diff.toVersion.versionNumber)}
      </p>
      <ul className="space-y-1 text-sm text-zinc-800">
        {summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {diff.fields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Alanlar
          </h4>
          <ul className="mt-2 space-y-2">
            {diff.fields.map((field) => (
              <li key={field.field} className="text-sm">
                <p className="font-medium text-zinc-900">
                  {fieldLabel(field.field)} · {changeTypeLabel(field.changeType)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {formatBooleanDiff(field.before)} → {formatBooleanDiff(field.after)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.body.changed && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Metin
          </h4>
          <ul className="mt-2 space-y-2">
            {diff.body.blocks
              .filter((block) => block.changeType !== "MOVED" || block.beforeText || block.afterText)
              .slice(0, 12)
              .map((block, index) => (
                <li key={`${block.blockType}-${index}`} className="text-sm">
                  <p className="text-xs font-medium text-zinc-500">
                    {changeTypeLabel(block.changeType)}
                  </p>
                  {block.inlineChanges && block.inlineChanges.length > 0 ? (
                    <p className="mt-1 text-zinc-800">
                      {block.inlineChanges.map((part, partIndex) => (
                        <span
                          key={partIndex}
                          className={
                            part.type === "ADDED"
                              ? "bg-emerald-50 text-emerald-900"
                              : part.type === "REMOVED"
                                ? "bg-red-50 text-red-800 line-through"
                                : ""
                          }
                        >
                          {part.text}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="mt-1 text-zinc-700">
                      {block.afterText || block.beforeText || "Blok değişti."}
                    </p>
                  )}
                </li>
              ))}
          </ul>
          {diff.body.detailLimited && (
            <p className="mt-2 text-xs text-zinc-500">
              Uzun metin karşılaştırması kısaltıldı.
            </p>
          )}
        </div>
      )}

      {(diff.relations.categories.primary.changed ||
        diff.relations.categories.added.length > 0 ||
        diff.relations.categories.removed.length > 0 ||
        diff.relations.tags.added.length > 0 ||
        diff.relations.tags.removed.length > 0 ||
        diff.relations.authors.added.length > 0 ||
        diff.relations.authors.removed.length > 0 ||
        diff.relations.authors.modified.length > 0 ||
        diff.relations.entities.added.length > 0 ||
        diff.relations.entities.removed.length > 0 ||
        diff.relations.entities.modified.length > 0 ||
        diff.relations.media.added.length > 0 ||
        diff.relations.media.removed.length > 0 ||
        diff.relations.media.modified.length > 0) && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            İlişkiler
          </h4>
          <ul className="mt-2 space-y-1 text-sm text-zinc-700">
            {diff.relations.categories.primary.changed && (
              <li>
                Ana kategori:{" "}
                {diff.relations.categories.primary.before?.label ?? "—"} →{" "}
                {diff.relations.categories.primary.after?.label ?? "—"}
              </li>
            )}
            {diff.relations.categories.added.map((item) => (
              <li key={`cat-add-${item.label}`}>Kategori eklendi: {item.label}</li>
            ))}
            {diff.relations.categories.removed.map((item) => (
              <li key={`cat-rem-${item.label}`}>
                Kategori kaldırıldı: {item.label}
              </li>
            ))}
            {diff.relations.authors.added.map((item) => (
              <li key={`auth-add-${item.label}`}>Yazar eklendi: {item.label}</li>
            ))}
            {diff.relations.authors.removed.map((item) => (
              <li key={`auth-rem-${item.label}`}>
                Yazar kaldırıldı: {item.label}
              </li>
            ))}
            {diff.relations.authors.modified.map((item) => (
              <li key={`auth-mod-${item.label}`}>Yazar rolü değişti: {item.label}</li>
            ))}
            {diff.relations.tags.added.map((item) => (
              <li key={`tag-add-${item.label}`}>Etiket eklendi: {item.label}</li>
            ))}
            {diff.relations.tags.removed.map((item) => (
              <li key={`tag-rem-${item.label}`}>
                Etiket kaldırıldı: {item.label}
              </li>
            ))}
            {diff.relations.entities.added.map((item) => (
              <li key={`ent-add-${item.label}`}>
                İlişkili kişi/konu eklendi: {item.label}
              </li>
            ))}
            {diff.relations.entities.removed.map((item) => (
              <li key={`ent-rem-${item.label}`}>
                İlişkili kişi/konu kaldırıldı: {item.label}
              </li>
            ))}
            {diff.relations.entities.modified.map((item) => (
              <li key={`ent-mod-${item.label}`}>
                İlişkili kayıt değişti: {item.label}
              </li>
            ))}
            {diff.relations.media.added.map((item) => (
              <li key={`media-add-${item.label}`}>Medya eklendi: {item.label}</li>
            ))}
            {diff.relations.media.removed.map((item) => (
              <li key={`media-rem-${item.label}`}>
                Medya kaldırıldı: {item.label}
              </li>
            ))}
            {diff.relations.media.modified.map((item) => (
              <li key={`media-mod-${item.label}`}>Medya değişti: {item.label}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        {workflow(String(diff.fromVersion.workflowStatus))}
        {", "}
        {formatDateTime(diff.fromVersion.createdAt)}
        {" → "}
        {workflow(String(diff.toVersion.workflowStatus))}
        {", "}
        {formatDateTime(diff.toVersion.createdAt)}
      </p>
    </div>
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
