"use client";

import { useState } from "react";
import { LookupPicker } from "./lookup-picker";
import {
  formatEditorMediaLabel,
  toMediaPickerOption,
  type MediaLookupOption,
} from "@/lib/content/lookup-labels";

type Props = {
  portraitMediaId: string | null;
  disabled?: boolean;
  onSelect: (mediaId: string) => void;
  onRemove: () => void;
};

async function fetchMedia(query: string): Promise<MediaLookupOption[]> {
  const params = new URLSearchParams({ mediaType: "IMAGE" });
  if (query) {
    params.set("q", query);
  }
  const response = await fetch(`/api/lookups/media?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const body = (await response.json()) as {
    ok: boolean;
    data?: { items: MediaLookupOption[] };
  };
  if (!response.ok || !body.ok || !body.data) {
    throw new Error("lookup failed");
  }
  return body.data.items;
}

export function EntityPortraitPicker({
  portraitMediaId,
  disabled,
  onSelect,
  onRemove,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<MediaLookupOption | null>(null);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-zinc-700">Portre</span>
      {portraitMediaId ? (
        <div className="rounded border border-zinc-200 p-3 text-sm">
          <p className="font-medium text-zinc-900">
            {selected
              ? formatEditorMediaLabel(selected)
              : "Seçili görsel (medya kimliği kayıtlı)"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPickerOpen(true)}
              className="h-8 rounded border border-zinc-300 px-2 text-xs"
            >
              Portreyi değiştir
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onRemove}
              className="h-8 rounded border border-zinc-300 px-2 text-xs"
            >
              Portreyi kaldır
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
          className="h-9 rounded border border-dashed border-zinc-300 px-3 text-sm text-zinc-700"
        >
          Portre seç
        </button>
      )}

      {pickerOpen ? (
        <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
          <LookupPicker
            label="Portre görseli"
            placeholder="Görsel seç"
            searchPlaceholder="Görsel ara…"
            value={null}
            initialOptions={[]}
            disabled={disabled}
            prefetchOnOpen
            clearLabel="Seçimi temizle"
            onSelect={(id) => {
              if (!id) {
                return;
              }
              onSelect(id);
              setPickerOpen(false);
            }}
            onSearch={async (query) => {
              const items = await fetchMedia(query);
              const match = items.find((item) => item.id === portraitMediaId);
              if (match) {
                setSelected(match);
              }
              return items.map(toMediaPickerOption);
            }}
            emptyLabel="Eşleşen görsel yok."
            errorLabel="Görseller yüklenemedi."
          />
          <button
            type="button"
            className="mt-2 text-xs text-zinc-600 underline"
            onClick={() => setPickerOpen(false)}
          >
            Kapat
          </button>
        </div>
      ) : null}
    </div>
  );
}
