"use client";

import { useRef } from "react";
import { LookupMultiPicker } from "./lookup-multi-picker";
import { LookupPicker } from "./lookup-picker";
import {
  toAuthorPickerOption,
  toCategoryPickerOption,
  toEntityPickerOption,
  toMediaPickerOption,
  toTagPickerOption,
  type AuthorLookupOption,
  type CategoryLookupOption,
  type EntityLookupOption,
  type MediaLookupOption,
  type TagLookupOption,
} from "@/lib/content/lookup-labels";

async function fetchLookupItems<T>(path: string, query: string): Promise<T[]> {
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

function useLookupCache<T extends { id: string }>(seed: readonly T[]) {
  const cacheRef = useRef(new Map<string, T>());

  function remember(items: readonly T[]) {
    for (const item of items) {
      cacheRef.current.set(item.id, item);
    }
  }

  function get(id: string): T | undefined {
    return cacheRef.current.get(id) ?? seed.find((item) => item.id === id);
  }

  return { remember, get };
}

export function PrimaryCategoryPicker({
  selected,
  disabled,
  onSelect,
}: {
  selected: CategoryLookupOption | null;
  disabled?: boolean;
  onSelect: (category: CategoryLookupOption | null) => void;
}) {
  const cache = useLookupCache(selected ? [selected] : []);

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-zinc-700">
        Ana kategori
      </span>
      <LookupPicker
        label="Ana kategori"
        placeholder="Ana kategori seç"
        searchPlaceholder="Kategori ara…"
        value={selected ? toCategoryPickerOption(selected) : null}
        initialOptions={selected ? [toCategoryPickerOption(selected)] : []}
        disabled={disabled}
        prefetchOnOpen
        clearLabel="Ana kategori seçimini temizle"
        onSelect={(id) => {
          if (!id) {
            onSelect(null);
            return;
          }
          const match = cache.get(id);
          if (match) {
            onSelect(match);
          }
        }}
        onSearch={async (query) => {
          const items = await fetchLookupItems<CategoryLookupOption>(
            "/api/lookups/categories",
            query,
          );
          cache.remember(items);
          return items.map(toCategoryPickerOption);
        }}
        emptyLabel="Eşleşen kategori yok."
        errorLabel="Kategoriler yüklenemedi."
      />
    </div>
  );
}

export function SecondaryCategoryPicker({
  selected,
  excludedIds,
  disabled,
  onAdd,
  onRemove,
}: {
  selected: CategoryLookupOption[];
  excludedIds: readonly string[];
  disabled?: boolean;
  onAdd: (category: CategoryLookupOption) => void;
  onRemove: (id: string) => void;
}) {
  const cache = useLookupCache(selected);

  return (
    <LookupMultiPicker
      label="Ek kategoriler"
      addLabel="+ Ekle"
      searchPlaceholder="Kategori ara…"
      selected={selected.map(toCategoryPickerOption)}
      excludedIds={excludedIds}
      disabled={disabled}
      onAdd={(option) => {
        const match = cache.get(option.id);
        if (match) {
          onAdd(match);
        }
      }}
      onRemove={onRemove}
      onSearch={async (query) => {
        const items = await fetchLookupItems<CategoryLookupOption>(
          "/api/lookups/categories",
          query,
        );
        cache.remember(items);
        return items.map(toCategoryPickerOption);
      }}
      emptyLabel="Eşleşen kategori yok."
      errorLabel="Kategoriler yüklenemedi."
    />
  );
}

export function AuthorRelationPicker({
  selected,
  disabled,
  onAdd,
  onRemove,
}: {
  selected: AuthorLookupOption[];
  disabled?: boolean;
  onAdd: (author: AuthorLookupOption) => void;
  onRemove: (id: string) => void;
}) {
  const cache = useLookupCache(selected);

  return (
    <LookupMultiPicker
      label="Yazar"
      addLabel="+ Ekle"
      searchPlaceholder="Yazar ara…"
      selected={selected.map(toAuthorPickerOption)}
      disabled={disabled}
      onAdd={(option) => {
        const match = cache.get(option.id);
        if (match) {
          onAdd(match);
        }
      }}
      onRemove={onRemove}
      onSearch={async (query) => {
        const items = await fetchLookupItems<AuthorLookupOption>(
          "/api/lookups/authors",
          query,
        );
        cache.remember(items);
        return items.map(toAuthorPickerOption);
      }}
      emptyLabel="Eşleşen yazar yok."
      errorLabel="Yazarlar yüklenemedi."
    />
  );
}

export function TagRelationPicker({
  selected,
  disabled,
  onAdd,
  onRemove,
}: {
  selected: TagLookupOption[];
  disabled?: boolean;
  onAdd: (tag: TagLookupOption) => void;
  onRemove: (id: string) => void;
}) {
  const cache = useLookupCache(selected);

  return (
    <LookupMultiPicker
      label="Etiketler"
      addLabel="+ Ekle"
      searchPlaceholder="Etiket ara…"
      selected={selected.map(toTagPickerOption)}
      disabled={disabled}
      onAdd={(option) => {
        const match = cache.get(option.id);
        if (match) {
          onAdd(match);
        }
      }}
      onRemove={onRemove}
      onSearch={async (query) => {
        const items = await fetchLookupItems<TagLookupOption>(
          "/api/lookups/tags",
          query,
        );
        cache.remember(items);
        return items.map(toTagPickerOption);
      }}
      emptyLabel="Eşleşen etiket yok."
      errorLabel="Etiketler yüklenemedi."
    />
  );
}

export function EntityRelationPicker({
  selected,
  disabled,
  onAdd,
  onRemove,
}: {
  selected: EntityLookupOption[];
  disabled?: boolean;
  onAdd: (entity: EntityLookupOption) => void;
  onRemove: (id: string) => void;
}) {
  const cache = useLookupCache(selected);

  return (
    <LookupMultiPicker
      label="İlişkili kişiler / konular"
      addLabel="+ Ekle"
      searchPlaceholder="Kişi veya konu ara…"
      selected={selected.map(toEntityPickerOption)}
      disabled={disabled}
      onAdd={(option) => {
        const match = cache.get(option.id);
        if (match) {
          onAdd(match);
        }
      }}
      onRemove={onRemove}
      onSearch={async (query) => {
        const items = await fetchLookupItems<EntityLookupOption>(
          "/api/lookups/entities",
          query,
        );
        cache.remember(items);
        return items.map(toEntityPickerOption);
      }}
      emptyLabel="Eşleşen kayıt yok."
      errorLabel="Varlıklar yüklenemedi."
    />
  );
}

export function HeroMediaPicker({
  selected,
  disabled,
  onSelect,
}: {
  selected: MediaLookupOption | null;
  disabled?: boolean;
  onSelect: (media: MediaLookupOption | null) => void;
}) {
  const cache = useLookupCache(selected ? [selected] : []);

  return (
    <div>
      <span className="mb-1 block text-sm font-medium text-zinc-700">
        Kapak görseli
      </span>
      <LookupPicker
        label="Kapak görseli"
        placeholder="Kapak görseli seç"
        searchPlaceholder="Medya ara…"
        value={selected ? toMediaPickerOption(selected) : null}
        initialOptions={selected ? [toMediaPickerOption(selected)] : []}
        disabled={disabled}
        prefetchOnOpen
        clearLabel="Kapak görselini kaldır"
        onSelect={(id) => {
          if (!id) {
            onSelect(null);
            return;
          }
          const match = cache.get(id);
          if (match) {
            onSelect(match);
          }
        }}
        onSearch={async (query) => {
          const items = await fetchLookupItems<MediaLookupOption>(
            "/api/lookups/media",
            query,
          );
          cache.remember(items);
          return items.map(toMediaPickerOption);
        }}
        emptyLabel="Eşleşen medya yok."
        errorLabel="Medya yüklenemedi."
      />
    </div>
  );
}

export function AssociatedMediaPicker({
  selected,
  excludedIds,
  disabled,
  onAdd,
  onRemove,
}: {
  selected: MediaLookupOption[];
  excludedIds: readonly string[];
  disabled?: boolean;
  onAdd: (media: MediaLookupOption) => void;
  onRemove: (id: string) => void;
}) {
  const cache = useLookupCache(selected);

  return (
    <LookupMultiPicker
      label="Habere bağlı diğer medya"
      addLabel="+ Ekle"
      searchPlaceholder="Medya ara…"
      selected={selected.map(toMediaPickerOption)}
      excludedIds={excludedIds}
      disabled={disabled}
      onAdd={(option) => {
        const match = cache.get(option.id);
        if (match) {
          onAdd(match);
        }
      }}
      onRemove={onRemove}
      onSearch={async (query) => {
        const items = await fetchLookupItems<MediaLookupOption>(
          "/api/lookups/media",
          query,
        );
        cache.remember(items);
        return items.map(toMediaPickerOption);
      }}
      emptyLabel="Eşleşen medya yok."
      errorLabel="Medya yüklenemedi."
    />
  );
}
