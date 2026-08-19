"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LookupPickerOption } from "./lookup-picker";

type Props = {
  label: string;
  addLabel: string;
  searchPlaceholder: string;
  selected: LookupPickerOption[];
  excludedIds?: readonly string[];
  onAdd: (option: LookupPickerOption) => void;
  onRemove: (id: string) => void;
  onSearch: (query: string) => Promise<LookupPickerOption[]>;
  emptyLabel: string;
  errorLabel: string;
  disabled?: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export function LookupMultiPicker({
  label,
  addLabel,
  searchPlaceholder,
  selected,
  excludedIds = [],
  onAdd,
  onRemove,
  onSearch,
  emptyLabel,
  errorLabel,
  disabled = false,
}: Props) {
  const buttonId = useId();
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LookupPickerOption[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [activeIndex, setActiveIndex] = useState(0);

  const blocked = useMemo(
    () => new Set([...selected.map((item) => item.id), ...excludedIds]),
    [excludedIds, selected],
  );
  const available = useMemo(
    () => options.filter((option) => !blocked.has(option.id)),
    [blocked, options],
  );
  const activeOption = available[activeIndex];

  useEffect(() => {
    if (!open) {
      return;
    }

    searchRef.current?.focus();

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openList() {
    if (disabled) {
      return;
    }
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    void runSearch("");
  }

  function closeList() {
    setOpen(false);
    setQuery("");
  }

  function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(nextQuery);
    }, 220);
  }

  async function runSearch(nextQuery: string) {
    setLoadState("loading");
    try {
      const results = await onSearch(nextQuery.trim());
      setOptions(results);
      setLoadState("ready");
      setActiveIndex(0);
    } catch {
      setLoadState("error");
    }
  }

  function selectOption(option: LookupPickerOption) {
    onAdd(option);
    closeList();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        available.length === 0 ? 0 : Math.min(current + 1, available.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeOption) {
        selectOption(activeOption);
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1 block text-sm font-medium text-zinc-700" id={`${buttonId}-label`}>
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((item) => (
          <span
            key={item.id}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-zinc-100 py-1 pl-2.5 pr-1 text-sm text-zinc-800"
          >
            <span className="truncate">{item.label}</span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`${item.label} öğesini kaldır`}
              onClick={() => onRemove(item.id)}
              className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:text-zinc-300"
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          id={buttonId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${buttonId}-label`}
          disabled={disabled}
          onClick={() => (open ? closeList() : openList())}
          className="h-8 rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:text-zinc-400"
        >
          {addLabel}
        </button>
      </div>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-64 max-w-[min(100vw-2rem,22rem)] rounded border border-zinc-200 bg-white p-2 shadow-sm">
          <label htmlFor={searchId} className="sr-only">
            {searchPlaceholder}
          </label>
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => handleSearch(event.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={
              activeOption ? `${listId}-${activeOption.id}` : undefined
            }
            className="mb-2 h-8 w-full rounded border border-zinc-300 px-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />

          {loadState === "loading" && (
            <p role="status" className="px-2 py-2 text-sm text-zinc-500">
              Yükleniyor…
            </p>
          )}
          {loadState === "error" && (
            <p role="alert" className="px-2 py-2 text-sm text-red-700">
              {errorLabel}
            </p>
          )}
          {loadState === "ready" && available.length === 0 && (
            <p className="px-2 py-2 text-sm text-zinc-500">{emptyLabel}</p>
          )}
          {loadState !== "error" && available.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={`${buttonId}-label`}
              className="max-h-64 overflow-y-auto"
            >
              {available.map((option, index) => {
                const active = index === activeIndex;
                return (
                  <li key={option.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${option.id}`}
                      role="option"
                      aria-selected={false}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                      className={`flex w-full flex-col rounded px-2 py-1.5 text-left text-sm ${
                        active ? "bg-zinc-100" : ""
                      } text-zinc-800`}
                    >
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-xs font-normal text-zinc-500">
                          {option.description}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
