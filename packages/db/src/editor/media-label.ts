export function formatEditorMediaLabel(input: {
  mediaType: string;
  width: number | null;
  height: number | null;
  originalFilename?: string | null;
  storageKey?: string | null;
}): string {
  const original = input.originalFilename?.trim();
  if (original) {
    return original;
  }

  if (input.storageKey) {
    const segments = input.storageKey.split("/").filter((part) => part.length > 0);
    if (segments.length > 0) {
      return segments[segments.length - 1]!;
    }
  }

  const typeLabel =
    input.mediaType === "IMAGE"
      ? "Görsel"
      : input.mediaType === "VIDEO"
        ? "Video"
        : input.mediaType === "AUDIO"
          ? "Ses"
          : "Medya";

  if (input.width && input.height) {
    return `${typeLabel} · ${input.width}×${input.height}`;
  }

  return typeLabel;
}
