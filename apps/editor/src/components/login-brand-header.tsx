export function LoginBrandHeader() {
  return (
    <header className="text-center">
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.32em] text-zinc-950">
        <span>Magazin</span>{" "}
        <span className="text-brand-magenta">CMS</span>
      </p>
      <p className="mt-2 text-[0.625rem] font-medium uppercase tracking-[0.28em] text-zinc-400">
        İçerik Yönetim Sistemi
      </p>
      <div
        className="mx-auto mt-5 h-px w-10 bg-brand-magenta"
        aria-hidden="true"
      />
    </header>
  );
}
