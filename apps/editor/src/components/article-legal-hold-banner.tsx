"use client";

type Props = {
  message: string;
};

export function ArticleLegalHoldBanner({ message }: Props) {
  return (
    <div
      role="alert"
      className="rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Legal hold aktif</p>
      <p className="mt-1">{message}</p>
    </div>
  );
}
