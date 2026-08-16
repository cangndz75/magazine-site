import { requireStaffSession } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function EditorHome() {
  const session = await requireStaffSession();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
          Magazin Editor
        </p>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-950">
          Editör platformu hazırlanıyor.
        </h1>

        <p className="mt-4 text-base text-zinc-600">{session.displayName}</p>

        <form method="post" action="/api/auth/logout" className="mt-8">
          <button
            className="text-sm text-zinc-600 underline"
            type="submit"
          >
            Çıkış
          </button>
        </form>
      </div>
    </main>
  );
}
