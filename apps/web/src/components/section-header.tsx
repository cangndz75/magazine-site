type SectionHeaderProps = {
  title: string;
  id?: string;
  variant?: "default" | "editorial";
};

export function SectionHeader({ title, id, variant = "default" }: SectionHeaderProps) {
  const className =
    variant === "editorial"
      ? "section-header section-header--editorial"
      : "section-header";

  return (
    <header className={className}>
      <h2 className="section-header__title" id={id}>{title}</h2>
    </header>
  );
}
