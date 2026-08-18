"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  REVIEW_NOTE_MAX_LENGTH,
  REVIEW_NOTE_MIN_LENGTH,
} from "@magazine/domain";
import {
  EDITORIAL_TIMEZONE_LABEL,
  editorialWallTimeToUtcIso,
  isUtcIsoInTheFuture,
  utcIsoToEditorialInputs,
} from "@/lib/content/editorial-timezone";
import { buildArticleHref } from "@/lib/content/content-href";
import { ArticleUnpublishDialog } from "@/components/article-unpublish-dialog";
import {
  presentWorkflow,
  revisionRequestSource,
  type WorkflowActionId,
  type WorkflowEligibilityInput,
} from "@/lib/content/workflow-eligibility";
import {
  isSuccessfulWorkflowResponse,
  parseWorkflowErrorCode,
  presentWorkflowFailure,
  presentWorkflowSuccess,
  type WorkflowMutationState,
} from "@/lib/content/workflow-messages";

type Props = {
  contentItemId: string;
  eligibility: WorkflowEligibilityInput;
  expectedUpdatedAt: string;
  fromReview: boolean;
  returnHref: string;
  onConcurrencyToken: (token: string) => void;
  onHistoryRefresh: () => void;
};

export function ArticleWorkflowPanel({
  contentItemId,
  eligibility,
  expectedUpdatedAt,
  fromReview,
  returnHref,
  onConcurrencyToken,
  onHistoryRefresh,
}: Props) {
  const router = useRouter();
  const presented = useMemo(() => presentWorkflow(eligibility), [eligibility]);
  const [state, setState] = useState<WorkflowMutationState>({ kind: "idle" });
  const [note, setNote] = useState("");
  const initialSchedule = eligibility.scheduledAt
    ? utcIsoToEditorialInputs(eligibility.scheduledAt)
    : null;
  const [scheduleDate, setScheduleDate] = useState(initialSchedule?.date ?? "");
  const [scheduleTime, setScheduleTime] = useState(initialSchedule?.time ?? "");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const pending = state.kind === "pending";

  const noteTrimmed = note.trim();
  const noteValid =
    noteTrimmed.length >= REVIEW_NOTE_MIN_LENGTH &&
    noteTrimmed.length <= REVIEW_NOTE_MAX_LENGTH;

  async function run(
    action: WorkflowActionId,
    path: string,
    body: Record<string, unknown>,
  ) {
    if (pending) {
      return;
    }

    setState({ kind: "pending", action });
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        data?: { updatedAt?: string };
        error?: { code?: string };
      };

      if (
        !isSuccessfulWorkflowResponse({
          okHttp: response.ok,
          okBody: Boolean(json.ok),
          hasData: Boolean(json.data),
        })
      ) {
        setState(presentWorkflowFailure(parseWorkflowErrorCode(json)));
        return;
      }

      if (typeof json.data?.updatedAt === "string") {
        onConcurrencyToken(json.data.updatedAt);
      }
      setConfirmPublish(false);
      setConfirmUnpublish(false);
      setState({ kind: "success", message: presentWorkflowSuccess(action) });
      onHistoryRefresh();
      if (action === "create-revision") {
        router.replace(
          buildArticleHref({
            contentItemId,
            from: fromReview ? "review" : null,
            returnTo: returnHref,
          }),
        );
      }
      router.refresh();
    } catch {
      setState(presentWorkflowFailure(undefined));
    }
  }

  function submitReview() {
    if (!eligibility.focusedVersionId) {
      return;
    }
    void run("submit-review", `/api/content/${contentItemId}/submit-review`, {
      versionId: eligibility.focusedVersionId,
      expectedUpdatedAt,
    });
  }

  function approve() {
    if (!eligibility.focusedVersionId) {
      return;
    }
    void run("approve", `/api/content/${contentItemId}/approve`, {
      versionId: eligibility.focusedVersionId,
      expectedUpdatedAt,
    });
  }

  function requestChanges() {
    if (!eligibility.focusedVersionId || !noteValid) {
      return;
    }
    void run("request-changes", `/api/content/${contentItemId}/request-changes`, {
      versionId: eligibility.focusedVersionId,
      expectedUpdatedAt,
      note: noteTrimmed,
    });
  }

  function publish() {
    if (!eligibility.focusedVersionId) {
      return;
    }
    void run("publish", `/api/content/${contentItemId}/publish`, {
      versionId: eligibility.focusedVersionId,
    });
  }

  function schedule(action: "schedule" | "reschedule") {
    const iso = editorialWallTimeToUtcIso(scheduleDate, scheduleTime);
    if (!iso) {
      setState({
        kind: "error",
        message: "Geçerli bir tarih ve saat seç.",
      });
      return;
    }
    if (!isUtcIsoInTheFuture(iso)) {
      setState({
        kind: "error",
        message: "Zamanlama şu andan sonra bir tarih ve saat olmalı.",
      });
      return;
    }

    if (action === "schedule") {
      if (!eligibility.focusedVersionId) {
        return;
      }
      void run("schedule", `/api/content/${contentItemId}/schedule`, {
        versionId: eligibility.focusedVersionId,
        scheduledAt: iso,
      });
      return;
    }

    void run("reschedule", `/api/content/${contentItemId}/reschedule`, {
      scheduledAt: iso,
    });
  }

  function unschedule() {
    void run("unschedule", `/api/content/${contentItemId}/unschedule`, {});
  }

  function createRevision() {
    const sourceVersionId = revisionRequestSource(eligibility);
    void run(
      "create-revision",
      `/api/content/${contentItemId}/revision`,
      sourceVersionId ? { sourceVersionId } : {},
    );
  }

  function unpublish() {
    setConfirmUnpublish(false);
    void run("unpublish", `/api/content/${contentItemId}/unpublish`, {});
  }

  function handlePrimary() {
    if (!presented.primary) {
      return;
    }
    if (presented.primary.id === "publish" && !confirmPublish) {
      setConfirmPublish(true);
      return;
    }
    dispatch(presented.primary.id);
  }

  function dispatch(id: WorkflowActionId) {
    if (id === "submit-review") submitReview();
    if (id === "approve") approve();
    if (id === "request-changes") requestChanges();
    if (id === "publish") publish();
    if (id === "schedule") schedule("schedule");
    if (id === "reschedule") schedule("reschedule");
    if (id === "unschedule") unschedule();
    if (id === "create-revision") createRevision();
    if (id === "unpublish") unpublish();
  }

  const schedulePrefill = eligibility.scheduledAt
    ? utcIsoToEditorialInputs(eligibility.scheduledAt)
    : null;

  return (
    <section aria-labelledby="workflow-actions-heading" aria-busy={pending}>
      <h2 id="workflow-actions-heading" className="text-sm font-semibold text-zinc-900">
        Karar
      </h2>
      <p className="mt-1 text-sm text-zinc-700">
        Yayın: {presented.publicationLabel}
        {" · "}
        İş akışı: {presented.workflowLabel}
        {" · "}
        {presented.focusedVersionLabel}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Yayındaki: {presented.publishedVersionLabel}
        {" · "}
        Taslak: {presented.draftVersionLabel}
        {presented.scheduledLabel ? ` · Zamanlanmış: ${presented.scheduledLabel}` : ""}
      </p>

      {presented.unavailableReason && (
        <p className="mt-3 text-sm text-zinc-600">{presented.unavailableReason}</p>
      )}

      {presented.createRevisionCopy && (
        <p className="mt-3 text-sm text-zinc-700">{presented.createRevisionCopy}</p>
      )}

      {presented.scheduledRepublishNotice && (
        <p role="status" className="mt-3 text-sm text-amber-800">
          {presented.scheduledRepublishNotice}
        </p>
      )}

      {presented.needsReviewNote && (
        <div className="mt-4">
          <label htmlFor="review-change-note" className="block text-sm font-medium text-zinc-800">
            Değişiklik gerekçesi
          </label>
          <textarea
            id="review-change-note"
            rows={3}
            value={note}
            disabled={pending}
            aria-invalid={note.length > 0 && !noteValid}
            aria-describedby="review-change-note-help"
            onChange={(event) => setNote(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50"
          />
          <p id="review-change-note-help" className="mt-1 text-xs text-zinc-500">
            {REVIEW_NOTE_MIN_LENGTH}–{REVIEW_NOTE_MAX_LENGTH} karakter. Bu not inceleme
            geçmişinde görünür.
          </p>
        </div>
      )}

      {presented.needsScheduleInput && (
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-zinc-800">Yayın zamanı</legend>
          <p className="mt-1 text-xs text-zinc-500">{EDITORIAL_TIMEZONE_LABEL}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="schedule-date" className="sr-only">
                Tarih
              </label>
              <input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                disabled={pending}
                onChange={(event) => setScheduleDate(event.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
            <div>
              <label htmlFor="schedule-time" className="sr-only">
                Saat
              </label>
              <input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                disabled={pending}
                onChange={(event) => setScheduleTime(event.target.value)}
                className="h-9 w-full rounded border border-zinc-300 px-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>
          </div>
          {schedulePrefill && (
            <button
              type="button"
              className="mt-2 text-xs text-zinc-600 underline hover:text-zinc-900"
              onClick={() => {
                setScheduleDate(schedulePrefill.date);
                setScheduleTime(schedulePrefill.time);
              }}
            >
              Mevcut zamanı doldur
            </button>
          )}
        </fieldset>
      )}

      {confirmPublish && (
        <p
          id="publish-confirm-copy"
          role="status"
          className="mt-3 text-sm text-zinc-800"
        >
          Bu sürüm hemen yayına alınır. Onay ve yayın ayrı işlemlerdir; bu adım
          geri alınamaz bir yayın kararıdır.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {presented.primary && (
          <button
            type="button"
            disabled={pending || isPrimaryDisabled(presented.primary.id, noteValid) || confirmUnpublish}
            onClick={handlePrimary}
            aria-describedby={
              confirmPublish && presented.primary.id === "publish"
                ? "publish-confirm-copy"
                : undefined
            }
            className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {pending && state.kind === "pending" && state.action === presented.primary.id
              ? "İşleniyor…"
              : confirmPublish && presented.primary.id === "publish"
                ? "Evet, yayınla"
                : presented.primary.label}
          </button>
        )}
        {confirmPublish && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmPublish(false)}
            className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Vazgeç
          </button>
        )}
        {presented.secondary.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={
              pending ||
              confirmPublish ||
              confirmUnpublish ||
              (action.id === "request-changes" && !noteValid)
            }
            onClick={() => dispatch(action.id)}
            className="h-9 rounded px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            {pending && state.kind === "pending" && state.action === action.id
              ? "İşleniyor…"
              : action.label}
          </button>
        ))}
      </div>

      {presented.unpublish && (
        <div className="mt-6 border-t border-zinc-200 pt-4">
          <h3 className="text-sm font-medium text-zinc-800">Yayın kontrolü</h3>
          <p className="mt-1 text-sm text-zinc-600">{presented.unpublishCopy}</p>
          <button
            type="button"
            disabled={pending || confirmPublish}
            aria-haspopup="dialog"
            aria-expanded={confirmUnpublish}
            onClick={() => setConfirmUnpublish(true)}
            className="mt-3 h-9 rounded px-3 text-sm font-medium text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            {pending && state.kind === "pending" && state.action === "unpublish"
              ? "İşleniyor…"
              : presented.unpublish.label}
          </button>
        </div>
      )}

      <ArticleUnpublishDialog
        open={confirmUnpublish}
        pending={pending && state.kind === "pending" && state.action === "unpublish"}
        scheduleWarning={presented.unpublishScheduleWarning}
        onConfirm={() => dispatch("unpublish")}
        onCancel={() => setConfirmUnpublish(false)}
      />

      {state.kind === "pending" && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-zinc-600">
          İşlem gönderiliyor…
        </p>
      )}
      {state.kind === "success" && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-emerald-800">
          {state.message}
        </p>
      )}
      {state.kind === "conflict" && (
        <div className="mt-3">
          <p role="alert" className="text-sm font-medium text-red-700">
            {state.message}
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="mt-2 text-sm font-medium text-zinc-800 underline"
          >
            Sayfayı yenile
          </button>
        </div>
      )}
      {state.kind === "error" && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {state.message}
        </p>
      )}

      {fromReview && (state.kind === "success" || presented.showReturnToQueue) && (
        <p className="mt-3 text-sm">
          <Link
            href={returnHref}
            className="font-medium text-zinc-800 underline hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            İnceleme kuyruğuna dön
          </Link>
        </p>
      )}
    </section>
  );
}

function isPrimaryDisabled(id: WorkflowActionId, noteValid: boolean): boolean {
  return id === "request-changes" && !noteValid;
}
