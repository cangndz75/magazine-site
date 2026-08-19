"use client";

import { useCallback, useState } from "react";

type ArticleShareProps = {
  title: string;
  url: string;
};

export function ArticleShare({ title, url }: ArticleShareProps) {
  const [copied, setCopied] = useState(false);
  const shareText = encodeURIComponent(title);
  const shareUrl = encodeURIComponent(url);
  const xHref = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [url]);

  return (
    <div className="article-share" aria-label="Paylaşım">
      <span className="article-share__label">Paylaş</span>
      <span className="article-share__sep"> · </span>
      <a
        href={xHref}
        className="article-share__action"
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
      <span className="article-share__sep"> · </span>
      <button type="button" className="article-share__action" onClick={handleCopy}>
        {copied ? "Kopyalandı" : "Kopyala"}
      </button>
    </div>
  );
}
