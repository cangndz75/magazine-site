import type { SuperAdminAttentionItem } from "@magazine/db/editor";

const NUMBER_FORMAT = new Intl.NumberFormat("tr-TR");
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Istanbul",
});
const DAY_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Istanbul",
});
const TIME_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});
const RELATIVE_FORMAT = new Intl.RelativeTimeFormat("tr-TR", { numeric: "auto" });

export function formatDashboardCount(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function formatDashboardDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  return DATE_TIME_FORMAT.format(new Date(value));
}

export function formatDashboardDay(value: string): string {
  return DAY_FORMAT.format(new Date(value));
}

export function formatDashboardTime(value: string): string {
  return TIME_FORMAT.format(new Date(value));
}

/** Compact relative time for recent events (e.g. "3 saat önce"). Falls back to an absolute date beyond a week. */
export function formatDashboardRelative(value: string, now: Date = new Date()): string {
  const target = new Date(value);
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  if (Math.abs(diffMinutes) < 60) {
    return RELATIVE_FORMAT.format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return RELATIVE_FORMAT.format(diffHours, "hour");
  }
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return RELATIVE_FORMAT.format(diffDays, "day");
  }
  return formatDashboardDateTime(value);
}

export type DashboardBadgeTone = "neutral" | "success" | "warning" | "info" | "danger";

export const ATTENTION_SIGNAL_LABEL: Record<SuperAdminAttentionItem["signal"], string> = {
  LEGAL_HOLD: "Hukuki bekletme",
  TAKEDOWN: "Kaldırma",
  RETRACTION: "Geri çekme",
  CHANGES_REQUESTED: "Değişiklik istendi",
  READINESS_BLOCKED: "Yayın hazırlığı engelli",
};

export const ATTENTION_SIGNAL_TONE: Record<SuperAdminAttentionItem["signal"], DashboardBadgeTone> = {
  LEGAL_HOLD: "danger",
  TAKEDOWN: "danger",
  RETRACTION: "danger",
  CHANGES_REQUESTED: "warning",
  READINESS_BLOCKED: "warning",
};

export function attentionSignalLabel(signal: SuperAdminAttentionItem["signal"]): string {
  return ATTENTION_SIGNAL_LABEL[signal] ?? signal;
}

export function attentionSignalTone(signal: SuperAdminAttentionItem["signal"]): DashboardBadgeTone {
  return ATTENTION_SIGNAL_TONE[signal] ?? "neutral";
}

const LEGAL_ACTION_LABEL: Record<string, string> = {
  CORRECTION: "Düzeltme",
  CLARIFICATION: "Açıklama",
  RETRACTION: "Geri çekme",
  TAKEDOWN: "Kaldırma",
  LEGAL_HOLD: "Hukuki bekletme",
};

export function legalActionLabel(actionType: string): string {
  return LEGAL_ACTION_LABEL[actionType] ?? actionType;
}

export const DASHBOARD_UNAVAILABLE_COPY = "Bu bölüm şu anda okunamıyor.";
