type PublicEntityBiographyProps = {
  biography: string;
};

function biographyParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .flatMap((block) => block.split(/\n/))
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function PublicEntityBiography({ biography }: PublicEntityBiographyProps) {
  const paragraphs = biographyParagraphs(biography);
  if (paragraphs.length === 0) {
    return null;
  }

  return (
    <section className="public-entity-biography" aria-label="Biyografi">
      <h2 className="public-entity-biography__title">Biyografi</h2>
      <div className="public-entity-biography__body">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="public-entity-biography__paragraph">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
