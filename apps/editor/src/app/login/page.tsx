import { redirect } from "next/navigation";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/constants";
import { getCurrentStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCurrentStaffSession();
  if (session) {
    redirect("/");
  }

  const params = await searchParams;
  const showError = params.error === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50">
      <form
        method="post"
        action="/api/auth/login"
        className="w-full max-w-sm px-6"
      >
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
          Magazin Editor
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
          Giriş
        </h1>

        {showError ? (
          <p className="mt-4 text-sm text-zinc-700" role="alert">
            {GENERIC_LOGIN_ERROR}
          </p>
        ) : null}

        <label className="mt-8 block text-sm text-zinc-700">
          E-posta
          <input
            className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 text-zinc-950"
            type="email"
            name="email"
            autoComplete="username"
            required
          />
        </label>

        <label className="mt-4 block text-sm text-zinc-700">
          Parola
          <input
            className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 text-zinc-950"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>

        <button
          className="mt-6 w-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white"
          type="submit"
        >
          Oturum aç
        </button>
      </form>
    </main>
  );
}
