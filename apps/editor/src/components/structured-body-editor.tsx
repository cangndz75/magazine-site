"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import History from "@tiptap/extension-history";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  bodyEditorDocumentsEqual,
  editorDocumentToTiptapDocument,
  isSafeHttpUrl,
  tiptapDocumentToEditorDocument,
  type BodyEditorDocument,
} from "@/lib/content/body-editor-state";

type Props = {
  document: BodyEditorDocument;
  disabled: boolean;
  error?: string;
  onChange: (document: BodyEditorDocument) => void;
};

const EXTENSIONS = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [2, 3] }),
  Bold,
  Italic,
  Link.configure({
    autolink: false,
    defaultProtocol: "https",
    linkOnPaste: false,
    openOnClick: false,
    protocols: ["http", "https"],
    validate: (href) => isSafeHttpUrl(href),
    HTMLAttributes: {
      class: "font-medium text-zinc-950 underline decoration-zinc-400 underline-offset-4",
      rel: "noopener noreferrer",
      target: "_blank",
    },
  }),
  History,
];

export function StructuredBodyEditor({
  document,
  disabled,
  error,
  onChange,
}: Props) {
  const [linkError, setLinkError] = useState<string | null>(null);
  const documentRef = useRef(document);
  const tiptapContent = useMemo(
    () => editorDocumentToTiptapDocument(document),
    [document],
  );
  const editor = useEditor({
    extensions: EXTENSIONS,
    content: tiptapContent,
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": "Makale gövdesi",
        class:
          "min-h-64 px-4 py-4 text-base leading-7 text-zinc-900 outline-none " +
          "prose-headings:font-semibold prose-a:text-zinc-950 prose-a:underline",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const parsed = tiptapDocumentToEditorDocument(currentEditor.getJSON());
      if (!parsed.ok) {
        setLinkError(parsed.message);
        return;
      }
      if (bodyEditorDocumentsEqual(parsed.document, documentRef.current)) {
        setLinkError(null);
        return;
      }
      setLinkError(null);
      onChange(parsed.document);
    },
  });

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const current = JSON.stringify(editor.getJSON());
    const next = JSON.stringify(tiptapContent);
    if (current !== next) {
      editor.commands.setContent(tiptapContent, { emitUpdate: false });
    }
  }, [editor, tiptapContent]);

  return (
    <section
      aria-labelledby="article-body-editor-title"
      className="border-t border-zinc-200 pt-6"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="article-body-editor-title" className="text-sm font-semibold text-zinc-900">
            Gövde
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Paragraf, ara başlık, kalın, italik ve bağlantı.
          </p>
        </div>
        {(error || linkError) && (
          <p className="text-sm font-medium text-red-700">{error ?? linkError}</p>
        )}
      </div>

      <div
        className="max-w-3xl overflow-hidden rounded border border-zinc-200 bg-white focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-100"
        aria-describedby={error || linkError ? "article-body-error" : undefined}
      >
        <BodyToolbar editor={editor} disabled={disabled} setLinkError={setLinkError} />
        <EditorContent
          editor={editor}
          className={[
            "[&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-2xl",
            "[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-xl",
            "[&_.ProseMirror_p]:my-3 [&_.ProseMirror_p]:min-h-6",
            "[&_.ProseMirror]:min-h-64 [&_.ProseMirror]:outline-none",
          ].join(" ")}
        />
      </div>

      {(error || linkError) && (
        <p id="article-body-error" className="mt-2 text-sm text-red-700">
          {error ?? linkError}
        </p>
      )}
    </section>
  );
}

function BodyToolbar({
  editor,
  disabled,
  setLinkError,
}: {
  editor: Editor | null;
  disabled: boolean;
  setLinkError: (message: string | null) => void;
}) {
  const unavailable = disabled || !editor;
  const blockValue = editor?.isActive("heading", { level: 2 })
    ? "heading-2"
    : editor?.isActive("heading", { level: 3 })
      ? "heading-3"
      : "paragraph";

  function setBlock(value: string) {
    if (!editor) {
      return;
    }
    if (value === "heading-2") {
      editor.chain().focus().setHeading({ level: 2 }).run();
      return;
    }
    if (value === "heading-3") {
      editor.chain().focus().setHeading({ level: 3 }).run();
      return;
    }
    editor.chain().focus().setParagraph().run();
  }

  function setLink() {
    if (!editor) {
      return;
    }
    const previous = editor.getAttributes("link").href;
    const next = window.prompt("Bağlantı URL", typeof previous === "string" ? previous : "");
    if (next === null) {
      setLinkError(null);
      return;
    }
    const href = next.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkError(null);
      return;
    }
    if (!isSafeHttpUrl(href)) {
      setLinkError("Bağlantı yalnızca HTTP veya HTTPS olabilir.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkError(null);
  }

  function removeLink() {
    if (!editor) {
      return;
    }
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkError(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-zinc-50 px-2 py-2">
      <label className="sr-only" htmlFor="body-format-block">
        Blok tipi
      </label>
      <select
        id="body-format-block"
        value={blockValue}
        disabled={unavailable}
        onChange={(event) => setBlock(event.target.value)}
        className="mr-2 h-8 rounded border border-zinc-300 bg-white px-2 text-xs font-medium text-zinc-700 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400"
      >
        <option value="paragraph">Paragraf</option>
        <option value="heading-2">H2</option>
        <option value="heading-3">H3</option>
      </select>

      <ToolbarButton
        label="Kalın"
        title="Kalın"
        active={Boolean(editor?.isActive("bold"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="İtalik"
        title="İtalik"
        active={Boolean(editor?.isActive("italic"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        I
      </ToolbarButton>
      <ToolbarButton
        label="Bağlantı ekle veya düzenle"
        title="Bağlantı ekle veya düzenle"
        active={Boolean(editor?.isActive("link"))}
        disabled={unavailable}
        onClick={setLink}
      >
        Link
      </ToolbarButton>
      <ToolbarButton
        label="Bağlantıyı kaldır"
        title="Bağlantıyı kaldır"
        active={false}
        disabled={unavailable || !editor?.isActive("link")}
        onClick={removeLink}
      >
        Kaldır
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  label,
  title,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        "h-8 rounded px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-zinc-500",
        active
          ? "bg-zinc-900 text-white"
          : "bg-transparent text-zinc-700 hover:bg-zinc-100",
        "disabled:cursor-not-allowed disabled:text-zinc-300",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
