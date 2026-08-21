import { redirect } from "next/navigation";
import { LoginMfaChallenge } from "@/components/login-mfa-challenge";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/constants";
import { safeInternalPath } from "@/lib/auth/origin";
import { getCurrentStaffSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    mfa?: string;
    returnTo?: string;
    reset_required?: string;
  }>;
}) {
  const session = await getCurrentStaffSession();
  if (session) {
    redirect("/");
  }

  const params = await searchParams;
  const showError = params.error === "1";
  const showMfa = params.mfa === "1";
  const showPasswordResetRequired = params.reset_required === "1";
  const returnTo = safeInternalPath(params.returnTo ?? null) ?? "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-8">
      {showMfa ? (
        <LoginMfaChallenge returnTo={returnTo} />
      ) : (
        <form
          method="post"
          action="/api/auth/login"
          className="w-full max-w-sm px-2 sm:px-6"
        >
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-zinc-500">
            Magazin Editor
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950">
            Giriş
          </h1>

          {showPasswordResetRequired ? (
            <div
              className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="alert"
            >
              Parolanızın sıfırlanması gerekiyor. Erişim için yöneticinizden parola sıfırlaması isteyin.
            </div>
          ) : null}

          {showError ? (
            <p className="mt-4 text-sm text-zinc-700" role="alert">
              {GENERIC_LOGIN_ERROR}
            </p>
          ) : null}

          <input type="hidden" name="returnTo" value={returnTo} />

          <label className="mt-8 block text-sm text-zinc-700">
            E-posta
            <input
              className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              type="email"
              name="email"
              autoComplete="username"
              required
            />
          </label>

          <label className="mt-4 block text-sm text-zinc-700">
            Parola
            <input
              className="mt-2 block w-full border border-zinc-300 bg-white px-3 py-2 text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>

          <button
            className="mt-6 w-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-zinc-500"
            type="submit"
          >
            Oturum aç
          </button>
        </form>
      )}
    </main>
  );
}
