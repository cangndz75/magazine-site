export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "neutral" | "success" | "warning" | "info";
}) {
  const classes: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-700",
    success: "bg-emerald-50 text-emerald-800",
    warning: "bg-amber-50 text-amber-800",
    info: "bg-sky-50 text-sky-800",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${classes[variant]}`}
    >
      {label}
    </span>
  );
}
