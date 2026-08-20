"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/content/format-date";
import {
  LEGAL_ACTION_FLOWS,
  LEGAL_ACTION_LABELS,
  LEGAL_POLARITY_LABELS,
  LEGAL_REASON_LABELS,
  presentLegalCurrentState,
  type LegalActionFlowId,
} from "@/lib/legal/presentation";
import {
  presentLegalFailure,
  presentLegalSuccess,
  type LegalMutationState,
} from "@/lib/legal/messages";
import { ArticleLegalActionDialog } from "@/components/article-legal-action-dialog";

type LegalWorkspaceAction = {
  id: string;
  actionType: string;
  polarity: string;
  reasonCategory: string;
  internalNote: string;
  publicNote: string | null;
  effectiveAt: string;
  createdAt: string;
  actor: { id: string; displayName: string };
};

type LegalWorkspace = {
  contentItem: {
    id: string;
    slug: string;
    title: string;
    publicationStatus: string;
    publishedVersionId: string | null;
    legalHoldAt: string | null;
    legalHoldReason: string | null;
    retractedAt: string | null;
    takedownAt: string | null;
    updatedAt: string;
  };
  actions: LegalWorkspaceAction[];
};

type Props = {
  contentItemId: string;
  canLegal: boolean;
  onConcurrencyToken?: (token: string) => void;
  onHistoryRefresh?: () => void;
};

export function ArticleLegalPanel({
  contentItemId,
  canLegal,
  onConcurrencyToken,
  onHistoryRefresh,
}: Props) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<LegalWorkspace | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [state, setState] = useState<LegalMutationState>({ kind: "idle" });
  const [activeFlow, setActiveFlow] = useState<LegalActionFlowId | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!canLegal) {
      return null;
    }
    const response = await fetch(`/api/content/${contentItemId}/legal`, {
      headers: { Accept: "application/json" },
    });
    const body = (await response.json()) as {
      ok?: boolean;
      data?: LegalWorkspace | null;
    };
    if (body.ok && body.data) {
      return body.data;
    }
    return null;
  }, [canLegal, contentItemId]);

  useEffect(() => {
    if (!canLegal) {
      return;
    }
    let active = true;
    void loadWorkspace()
      .then((data) => {
        if (active) {
          setWorkspace(data);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) {
          setWorkspace(null);
          setLoadState("error");
        }
      });
    return () => {
      active = false;
    };
  }, [canLegal, loadWorkspace]);

  if (!canLegal) {
    return null;
  }

  if (loadState === "loading" && !workspace) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-zinc-900">Yasal / düzeltmeler</h2>
        <p className="mt-2 text-sm text-zinc-500">Yükleniyor…</p>
      </section>
    );
  }

  if (!workspace) {
    return (
      <section>
        <h2 className="text-sm font-semibold text-zinc-900">Yasal / düzeltmeler</h2>
        <p className="mt-2 text-sm text-zinc-500">Yasal veri yüklenemedi.</p>
      </section>
    );
  }

  const item = workspace.contentItem;
  const pending = state.kind === "pending";
  const availableFlows: LegalActionFlowId[] = [];

  if (!item.retractedAt && !item.takedownAt) {
    availableFlows.push("correction", "clarification", "retraction", "takedown");
  }
  if (!item.legalHoldAt) {
    availableFlows.push("legal-hold-apply");
  } else {
    availableFlows.push("legal-hold-release");
  }

  async function submitAction(input: {
    flowId: LegalActionFlowId;
    reasonCategory: string;
    internalNote: string;
    publicNote: string | null;
  }) {
    const flow = LEGAL_ACTION_FLOWS[input.flowId];
    setState({ kind: "pending" });
    try {
      const response = await fetch(`/api/content/${contentItemId}/legal`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actionType: flow.actionType,
          polarity: flow.polarity,
          reasonCategory: input.reasonCategory,
          internalNote: input.internalNote,
          publicNote: input.publicNote,
          expectedUpdatedAt: item.updatedAt,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        data?: {
          result?: { updatedAt?: string };
          workspace?: LegalWorkspace;
        };
        error?: { code?: string };
      };

      if (!body.ok || !body.data?.result) {
        setState({
          kind: "error",
          code: body.error?.code ?? "UNKNOWN",
          message: presentLegalFailure(body.error?.code),
        });
        return;
      }

      if (body.data.workspace) {
        setWorkspace(body.data.workspace);
      } else {
        const refreshed = await loadWorkspace();
        if (refreshed) {
          setWorkspace(refreshed);
        }
      }
      if (body.data.result.updatedAt && onConcurrencyToken) {
        onConcurrencyToken(body.data.result.updatedAt);
      }
      onHistoryRefresh?.();
      setActiveFlow(null);
      setState({
        kind: "success",
        message: presentLegalSuccess(flow.actionType, flow.polarity),
      });
      router.refresh();
    } catch {
      setState({
        kind: "error",
        code: "UNKNOWN",
        message: presentLegalFailure(undefined),
      });
    }
  }

  return (
    <section aria-labelledby="article-legal-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="article-legal-heading" className="text-sm font-semibold text-zinc-900">
          Yasal / düzeltmeler
        </h2>
        <Link
          href="/legal"
          className="text-xs font-medium text-zinc-600 underline hover:text-zinc-900"
        >
          Yasal pano
        </Link>
      </div>

      <p className="mt-2 text-sm text-zinc-700">
        Durum:{" "}
        {presentLegalCurrentState({
          legalHoldAt: item.legalHoldAt,
          retractedAt: item.retractedAt,
          takedownAt: item.takedownAt,
          publicationStatus: item.publicationStatus,
        })}
      </p>

      {state.kind === "success" ? (
        <p className="mt-2 text-sm text-green-800" role="status">{state.message}</p>
      ) : null}
      {state.kind === "error" ? (
        <p className="mt-2 text-sm text-red-800" role="alert">{state.message}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {availableFlows.map((flowId) => (
          <button
            key={flowId}
            type="button"
            disabled={pending}
            onClick={() => {
              setState({ kind: "idle" });
              setActiveFlow(flowId);
            }}
            className="h-8 rounded border border-zinc-300 px-2.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            {LEGAL_ACTION_FLOWS[flowId].title}
          </button>
        ))}
      </div>

      <ol className="mt-4 space-y-3 border-t border-zinc-200 pt-4">
        {workspace.actions.length === 0 ? (
          <li className="text-sm text-zinc-500">Henüz yasal kayıt yok.</li>
        ) : (
          workspace.actions.map((action) => (
            <li
              key={action.id}
              className="rounded border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <p className="font-medium text-zinc-900">
                {LEGAL_ACTION_LABELS[action.actionType as keyof typeof LEGAL_ACTION_LABELS] ??
                  action.actionType}
                {action.actionType === "LEGAL_HOLD"
                  ? ` · ${LEGAL_POLARITY_LABELS[action.polarity as keyof typeof LEGAL_POLARITY_LABELS]}`
                  : null}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDateTime(action.effectiveAt)} · {action.actor.displayName} ·{" "}
                {LEGAL_REASON_LABELS[action.reasonCategory as keyof typeof LEGAL_REASON_LABELS]}
              </p>
              {action.publicNote ? (
                <p className="mt-2 text-zinc-700">
                  <span className="font-medium">Kamu notu:</span> {action.publicNote}
                </p>
              ) : null}
              <p className="mt-2 text-zinc-600">
                <span className="font-medium text-zinc-700">İç not:</span>{" "}
                {action.internalNote}
              </p>
            </li>
          ))
        )}
      </ol>

      {activeFlow ? (
        <ArticleLegalActionDialog
          key={activeFlow}
          open={true}
          flowId={activeFlow}
          pending={pending}
          articleTitle={item.title}
          articleSlug={item.slug}
          onCancel={() => {
            if (!pending) {
              setActiveFlow(null);
            }
          }}
          onConfirm={(input) =>
            void submitAction({
              flowId: activeFlow,
              ...input,
            })
          }
        />
      ) : null}
    </section>
  );
}
