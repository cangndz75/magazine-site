"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type LookupPickerOption = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  value: LookupPickerOption | null;
  initialOptions: LookupPickerOption[];
  onSelect: (id: string | null) => void;
  onSearch: (query: string) => Promise<LookupPickerOption[]>;
  emptyLabel: string;
  errorLabel: string;
  disabled?: boolean;
  clearLabel?: string;
  prefetchOnOpen?: boolean;
};

type LoadState = "idle" | "loading" | "ready" | "error";

export function LookupPicker({
  label,
  placeholder,
  searchPlaceholder,
  value,
  initialOptions,
  onSelect,
  onSearch,
  emptyLabel,
  errorLabel,
  disabled = false,
  clearLabel,
  prefetchOnOpen = false,
}: Props) {
  const buttonId = useId();
  const listId = useId();
  const searchId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchedOptions, setSearchedOptions] = useState<
    LookupPickerOption[] | null
  >(null);
  const [loadState, setLoadState] = useState<LoadState>("ready");
  const [activeIndex, setActiveIndex] = useState(0);

  const options = searchedOptions ?? initialOptions;
  const mergedOptions = useMemo(() => {
    if (!value) {
      return options;
    }
    if (options.some((option) => option.id === value.id)) {
      return options;
    }
    return [value, ...options];
  }, [options, value]);

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
    setSearchedOptions(null);
    setLoadState("ready");
    setActiveIndex(0);
    if (prefetchOnOpen) {
      void runSearch("");
    }
  }

  function closeList() {
    setOpen(false);
    setQuery("");
    setSearchedOptions(null);
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
    const trimmed = nextQuery.trim();
    if (trimmed.length === 0 && !prefetchOnOpen) {
      setSearchedOptions(null);
      setLoadState("ready");
      setActiveIndex(0);
      return;
    }
    setLoadState("loading");
    try {
      const results = await onSearch(trimmed);
      setSearchedOptions(results);
      setLoadState("ready");
      setActiveIndex(0);
    } catch {
      setLoadState("error");
    }
  }

  function selectOption(option: LookupPickerOption | null) {
    onSelect(option?.id ?? null);
    closeList();
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openList();
    }
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
        mergedOptions.length === 0 ? 0 : Math.min(current + 1, mergedOptions.length - 1),
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
      const option = mergedOptions[activeIndex];
      if (option) {
        selectOption(option);
      }
    }
  }

  const activeOption = mergedOptions[activeIndex];

  return (
    <div ref={rootRef} className="relative">
      <span className="sr-only" id={`${buttonId}-label`}>
        {label}
      </span>
      <div className="flex h-8 items-stretch overflow-hidden rounded border border-zinc-300 bg-white focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
        <button
          type="button"
          id={buttonId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-labelledby={`${buttonId}-label`}
          disabled={disabled}
          onClick={() => (open ? closeList() : openList())}
          onKeyDown={onButtonKeyDown}
          className="min-w-0 max-w-full flex-1 truncate px-2 text-left text-sm text-zinc-800 disabled:text-zinc-400"
        >
          {value ? value.label : placeholder}
        </button>
        {value && (
          <button
            type="button"
            aria-label={clearLabel ?? `${label} seçimini temizle`}
            onClick={() => selectOption(null)}
            className="border-l border-zinc-200 px-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-64 max-w-[min(100vw-2rem,20rem)] rounded border border-zinc-200 bg-white p-2 shadow-sm">
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

          {loadState === "ready" && mergedOptions.length === 0 && (
            <p className="px-2 py-2 text-sm text-zinc-500">{emptyLabel}</p>
          )}

          {loadState !== "error" && mergedOptions.length > 0 && (
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={`${buttonId}-label`}
              className="max-h-64 overflow-y-auto"
            >
              {mergedOptions.map((option, index) => {
                const selected = value?.id === option.id;
                const active = index === activeIndex;
                return (
                  <li key={option.id} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${option.id}`}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option)}
                      className={`flex w-full flex-col rounded px-2 py-1.5 text-left text-sm ${
                        active ? "bg-zinc-100" : ""
                      } ${selected ? "font-medium text-zinc-950" : "text-zinc-800"}`}
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
