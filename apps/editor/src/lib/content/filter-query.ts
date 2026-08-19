export function applyFilterUpdates(
  current: { toString(): string },
  updates: Record<string, string | null>,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  params.delete("cursor");
  return params;
}

export function applyCursorUpdate(
  current: { toString(): string },
  cursor: string,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  params.set("cursor", cursor);
  return params;
}

export function hrefWithQuery(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function mergeSelectedOption<T extends { id: string }>(
  selected: T | null,
  options: T[],
): T[] {
  if (!selected) {
    return options;
  }

  if (options.some((option) => option.id === selected.id)) {
    return options;
  }

  return [selected, ...options];
}
