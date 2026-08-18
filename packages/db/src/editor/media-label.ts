export function formatEditorMediaLabel(input: {
  mediaType: string;
  width: number | null;
  height: number | null;
}): string {
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
