import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { LoginMfaChallenge } from "@/components/login-mfa-challenge";
import { LoginShell } from "@/components/login-shell";
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
    <LoginShell>
      {showMfa ? (
        <LoginMfaChallenge returnTo={returnTo} />
      ) : (
        <LoginForm
          returnTo={returnTo}
          errorMessage={showError ? GENERIC_LOGIN_ERROR : null}
          showPasswordResetRequired={showPasswordResetRequired}
        />
      )}
    </LoginShell>
  );
}
