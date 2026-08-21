/**
 * Page-view lifecycle memory. Keys live only in module memory for this
 * document. They are never written to durable browser storage.
 */

const claimed = new Set<string>();
const pageViewContextIds = new Map<string, string>();

export function browserNavigationGeneration(): string {
  if (typeof window === "undefined") {
    return "ssr";
  }

  const navigation = (
    window as Window & {
      navigation?: { currentEntry?: { id?: string } };
    }
  ).navigation;
  if (typeof navigation?.currentEntry?.id === "string") {
    return `nav:${navigation.currentEntry.id}`;
  }

  const state = window.history.state as { idx?: unknown; key?: unknown } | null;
  if (state && typeof state.idx === "number") {
    return `idx:${state.idx}`;
  }
  if (state && typeof state.key === "string") {
    return `key:${state.key}`;
  }
  return `path:${window.location.pathname}`;
}

export function claimPageViewOnce(key: string): boolean {
  if (claimed.has(key)) {
    return false;
  }
  claimed.add(key);
  return true;
}

export function pageViewContextIdFor(
  key: string,
  createId: () => string,
): string {
  const existing = pageViewContextIds.get(key);
  if (existing) {
    return existing;
  }
  const id = createId();
  pageViewContextIds.set(key, id);
  return id;
}

export function resetPageViewLifecycleForTests(): void {
  claimed.clear();
  pageViewContextIds.clear();
}
