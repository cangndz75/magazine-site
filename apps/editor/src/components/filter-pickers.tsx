"use client";

import { LookupPicker } from "./lookup-picker";
import {
  toAuthorPickerOption,
  toCategoryPickerOption,
  type AuthorLookupOption,
  type CategoryLookupOption,
} from "@/lib/content/lookup-labels";

async function fetchLookupItems<T>(
  path: string,
  query: string,
): Promise<T[]> {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  const response = await fetch(`${path}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const body = (await response.json()) as {
    ok: boolean;
    data?: { items: T[] };
  };
  if (!response.ok || !body.ok || !body.data) {
    throw new Error("lookup failed");
  }
  return body.data.items;
}

export function CategoryFilterPicker({
  selected,
  initialOptions,
  onSelect,
}: {
  selected: CategoryLookupOption | null;
  initialOptions: CategoryLookupOption[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <LookupPicker
      label="Kategori"
      placeholder="Kategori"
      searchPlaceholder="Kategori ara…"
      value={selected ? toCategoryPickerOption(selected) : null}
      initialOptions={initialOptions.map(toCategoryPickerOption)}
      onSelect={onSelect}
      onSearch={async (query) => {
        const items = await fetchLookupItems<CategoryLookupOption>(
          "/api/lookups/categories",
          query,
        );
        return items.map(toCategoryPickerOption);
      }}
      emptyLabel="Eşleşen kategori yok."
      errorLabel="Kategoriler yüklenemedi."
      clearLabel="Kategori filtresini temizle"
    />
  );
}

export function AuthorFilterPicker({
  selected,
  initialOptions,
  onSelect,
}: {
  selected: AuthorLookupOption | null;
  initialOptions: AuthorLookupOption[];
  onSelect: (id: string | null) => void;
}) {
  return (
    <LookupPicker
      label="Yazar"
      placeholder="Yazar"
      searchPlaceholder="Yazar ara…"
      value={selected ? toAuthorPickerOption(selected) : null}
      initialOptions={initialOptions.map(toAuthorPickerOption)}
      onSelect={onSelect}
      onSearch={async (query) => {
        const items = await fetchLookupItems<AuthorLookupOption>(
          "/api/lookups/authors",
          query,
        );
        return items.map(toAuthorPickerOption);
      }}
      emptyLabel="Eşleşen yazar yok."
      errorLabel="Yazarlar yüklenemedi."
      clearLabel="Yazar filtresini temizle"
    />
  );
}
