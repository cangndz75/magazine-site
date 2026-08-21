type LoginShellProps = {
  children: React.ReactNode;
};

export function LoginShell({ children }: LoginShellProps) {
  const year = new Date().getFullYear();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f9f8f7]">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-24 -top-24 h-[min(520px,70vw)] w-[min(520px,70vw)] rounded-full bg-brand-magenta/[0.07] blur-[100px] md:-right-32 md:-top-32" />
        <div className="absolute -bottom-32 -left-24 h-[min(560px,75vw)] w-[min(560px,75vw)] rounded-full bg-brand-magenta/[0.05] blur-[110px] md:-bottom-40 md:-left-32" />

        <span className="absolute -left-[0.12em] top-[8%] hidden font-serif text-[clamp(14rem,28vw,22rem)] font-medium leading-none tracking-tight text-brand-magenta/[0.045] select-none sm:block lg:top-[10%]">
          M
        </span>
        <span className="absolute -right-[0.08em] bottom-[6%] hidden font-serif text-[clamp(12rem,24vw,18rem)] font-medium leading-none tracking-tight text-brand-magenta/[0.035] select-none md:block">
          N
        </span>
      </div>

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-[18px] py-8 sm:px-6 md:py-10 lg:px-8">
        <div className="w-full max-w-[450px] rounded-2xl border border-zinc-200/90 bg-white px-6 py-8 shadow-[0_20px_50px_-12px_rgba(24,24,27,0.08),0_8px_16px_-8px_rgba(24,24,27,0.04)] sm:px-9 sm:py-10">
          {children}
        </div>

        <footer className="mt-8 text-center text-xs text-zinc-400">
          © {year}{" "}
          <span className="text-brand-magenta">Magazin CMS</span>
        </footer>
      </main>
    </div>
  );
}
