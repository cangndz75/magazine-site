import type { ArticleEditorFields } from "@/lib/content/article-editor-state";
import {
  editorDocumentToBody,
  type BodyEditorDocument,
} from "@/lib/content/body-editor-state";

function galleryFallbackBodyText(fields: ArticleEditorFields): string {
  const excerpt = fields.excerpt?.trim();
  if (excerpt) {
    return excerpt;
  }
  const subtitle = fields.subtitle?.trim();
  if (subtitle) {
    return subtitle;
  }
  const title = fields.title.trim();
  return title || "Foto galeri";
}

export function ensureGalleryBodyDocument(
  bodyDocument: BodyEditorDocument,
  fields: ArticleEditorFields,
): BodyEditorDocument {
  const canonical = editorDocumentToBody(bodyDocument);
  const hasText = canonical.blocks.some((block) => {
    if ("text" in block && block.text) {
      return block.text.trim().length > 0;
    }
    if ("content" in block && block.content) {
      return block.content.some((inline) => inline.text.trim().length > 0);
    }
    return false;
  });

  if (hasText) {
    return bodyDocument;
  }

  return {
    blocks: [
      {
        type: "paragraph",
        text: galleryFallbackBodyText(fields),
        content: [{ text: galleryFallbackBodyText(fields) }],
      },
    ],
  };
}
