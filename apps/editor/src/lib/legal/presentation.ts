import {
  CONTENT_LEGAL_ACTION_POLARITY,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  type ContentLegalActionPolarity,
  type ContentLegalActionType,
  type ContentLegalReasonCategory,
} from "@magazine/domain";

export const LEGAL_ACTION_LABELS: Record<ContentLegalActionType, string> = {
  [CONTENT_LEGAL_ACTION_TYPE.CORRECTION]: "Düzeltme",
  [CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION]: "Açıklama",
  [CONTENT_LEGAL_ACTION_TYPE.RETRACTION]: "Geri çekme",
  [CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN]: "Hukuki kaldırma",
  [CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD]: "Legal hold",
};

export const LEGAL_POLARITY_LABELS: Record<ContentLegalActionPolarity, string> = {
  [CONTENT_LEGAL_ACTION_POLARITY.APPLY]: "Uygula",
  [CONTENT_LEGAL_ACTION_POLARITY.RELEASE]: "Kaldır",
};

export const LEGAL_REASON_LABELS: Record<ContentLegalReasonCategory, string> = {
  [CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR]: "Hatalı bilgi",
  [CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION]: "Açıklama",
  [CONTENT_LEGAL_REASON_CATEGORY.PRIVACY]: "Gizlilik",
  [CONTENT_LEGAL_REASON_CATEGORY.DEFAMATION]: "İftira / karalama",
  [CONTENT_LEGAL_REASON_CATEGORY.COPYRIGHT]: "Telif",
  [CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER]: "Mahkeme kararı",
  [CONTENT_LEGAL_REASON_CATEGORY.REGULATORY]: "Düzenleyici",
  [CONTENT_LEGAL_REASON_CATEGORY.LEGAL_COMPLAINT]: "Hukuki şikayet",
  [CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS]: "Editöryal standartlar",
  [CONTENT_LEGAL_REASON_CATEGORY.SAFETY]: "Güvenlik",
  [CONTENT_LEGAL_REASON_CATEGORY.OTHER]: "Diğer",
};

export type LegalActionFlowId =
  | "correction"
  | "clarification"
  | "retraction"
  | "takedown"
  | "legal-hold-apply"
  | "legal-hold-release";

export type LegalActionFlowDefinition = {
  id: LegalActionFlowId;
  actionType: ContentLegalActionType;
  polarity: ContentLegalActionPolarity;
  title: string;
  confirmTitle: string;
  consequenceSummary: string;
  requiresPublicNote: boolean;
  showPublicPreview: boolean;
  destructive: boolean;
};

export const LEGAL_ACTION_FLOWS: Record<LegalActionFlowId, LegalActionFlowDefinition> = {
  correction: {
    id: "correction",
    actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
    polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
    title: "Düzeltme yayınla",
    confirmTitle: "Düzeltmeyi kaydet",
    consequenceSummary:
      "Haber yayında kalacak. Sitede ayrı bir düzeltme bildirimi görünecek; yayın tarihi ve sürüm geçmişi değişmeyecek.",
    requiresPublicNote: false,
    showPublicPreview: true,
    destructive: false,
  },
  clarification: {
    id: "clarification",
    actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
    polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
    title: "Açıklama ekle",
    confirmTitle: "Açıklamayı kaydet",
    consequenceSummary:
      "Haber yayında kalacak. Sitede düzeltmeden ayrı bir açıklama bildirimi görünecek.",
    requiresPublicNote: false,
    showPublicPreview: true,
    destructive: false,
  },
  retraction: {
    id: "retraction",
    actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
    polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
    title: "Haberi geri çek",
    confirmTitle: "Geri çekmeyi onayla",
    consequenceSummary:
      "Haber sitede geri çekildi olarak işaretlenecek. Makale gövdesi ve medya artık otorite olarak sunulmayacak; içerik ve geçmiş silinmeyecek.",
    requiresPublicNote: false,
    showPublicPreview: true,
    destructive: true,
  },
  takedown: {
    id: "takedown",
    actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
    polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
    title: "Hukuki kaldırma",
    confirmTitle: "Hukuki kaldırmayı onayla",
    consequenceSummary:
      "Korunan içerik siteden kaldırılacak. Makale gövdesi ve medya kamuya açık olmayacak; iç kayıtlar ve kanıtlar korunacak.",
    requiresPublicNote: false,
    showPublicPreview: false,
    destructive: true,
  },
  "legal-hold-apply": {
    id: "legal-hold-apply",
    actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
    polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
    title: "Legal hold uygula",
    confirmTitle: "Legal hold uygula",
    consequenceSummary:
      "Yayınlama, yayından kaldırma, taslak düzenleme, sürüm ve ilişki değişiklikleri engellenecek. Kamu okuması engellenmez.",
    requiresPublicNote: false,
    showPublicPreview: false,
    destructive: true,
  },
  "legal-hold-release": {
    id: "legal-hold-release",
    actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
    polarity: CONTENT_LEGAL_ACTION_POLARITY.RELEASE,
    title: "Legal hold kaldır",
    confirmTitle: "Legal hold kaldır",
    consequenceSummary:
      "Engellenen editöryal işlemler yeniden açılacak. Bu işlem geçmişteki yasal eylemleri geri almaz.",
    requiresPublicNote: false,
    showPublicPreview: false,
    destructive: false,
  },
};

export const LEGAL_HOLD_BLOCKED_COPY =
  "Legal hold aktif: yayınlama, yayından kaldırma, taslak kaydı, sürüm oluşturma, medya/galeri/video ve diğer editöryal değişiklikler engellendi.";

export function presentLegalCurrentState(input: {
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  publicationStatus: string;
}): string {
  if (input.takedownAt) {
    return "Hukuki kaldırıldı";
  }
  if (input.retractedAt) {
    return "Geri çekildi";
  }
  if (input.legalHoldAt) {
    return "Legal hold aktif";
  }
  if (input.publicationStatus === "PUBLISHED") {
    return "Yayında";
  }
  if (input.publicationStatus === "UNPUBLISHED") {
    return "Yayından kaldırıldı (normal)";
  }
  return "Yayınlanmamış";
}

export function buildPublicNoticePreview(input: {
  kind: "CORRECTION" | "CLARIFICATION" | "RETRACTION";
  publicNote: string | null;
}): { label: string; body: string } {
  const defaults: Record<typeof input.kind, { label: string; body: string }> = {
    CORRECTION: {
      label: "Düzeltme",
      body: "Bu yazıda bir düzeltme yapılmıştır.",
    },
    CLARIFICATION: {
      label: "Açıklama",
      body: "Bu yazıya bir açıklama eklenmiştir.",
    },
    RETRACTION: {
      label: "Geri çekildi",
      body: "Bu yazı geri çekilmiştir.",
    },
  };
  const base = defaults[input.kind];
  const trimmed = input.publicNote?.trim();
  return {
    label: base.label,
    body: trimmed && trimmed.length > 0 ? trimmed : base.body,
  };
}
