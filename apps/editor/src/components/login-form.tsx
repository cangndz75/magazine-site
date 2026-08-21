"use client";

import { useState } from "react";
import {
  LoginArrowIcon,
  LoginEnvelopeIcon,
  LoginEyeIcon,
  LoginEyeOffIcon,
  LoginLockIcon,
  LoginShieldIcon,
} from "@/components/login-icons";
import { LoginBrandHeader } from "@/components/login-brand-header";

const inputClassName =
  "block h-[50px] w-full rounded-md border border-zinc-200 bg-white pl-10 pr-3 text-[0.9375rem] text-zinc-950 placeholder:text-zinc-400 focus:border-brand-magenta focus:outline-none focus:ring-2 focus:ring-brand-magenta/20";

type LoginFormProps = {
  returnTo: string;
  errorMessage: string | null;
  showPasswordResetRequired: boolean;
};

export function LoginForm({
  returnTo,
  errorMessage,
  showPasswordResetRequired,
}: LoginFormProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <form method="post" action="/api/auth/login" className="w-full">
      <LoginBrandHeader />

      <h1 className="mt-8 text-center font-serif text-[2.125rem] font-medium leading-tight tracking-tight text-zinc-950 sm:text-[2.375rem]">
        Yönetici Girişi
      </h1>
      <p className="mx-auto mt-3 max-w-[18rem] text-center text-sm leading-relaxed text-zinc-500">
        Yönetici paneline erişmek için hesabınızla giriş yapın.
      </p>

      {showPasswordResetRequired ? (
        <div
          className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
          role="alert"
        >
          Parolanızın sıfırlanması gerekiyor. Erişim için yöneticinizden parola
          sıfırlaması isteyin.
        </div>
      ) : null}

      {errorMessage ? (
        <p className="mt-5 text-center text-sm text-red-800/90" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="login-email"
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-700"
          >
            E-posta
          </label>
          <div className="relative">
            <LoginEnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" />
            <input
              id="login-email"
              className={inputClassName}
              type="email"
              name="email"
              autoComplete="username"
              placeholder="ornek@alanadi.com"
              required
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-700"
          >
            Parola
          </label>
          <div className="relative">
            <LoginLockIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400" />
            <input
              id="login-password"
              className={`${inputClassName} pr-11`}
              type={passwordVisible ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="Parolanızı girin"
              required
              minLength={12}
              maxLength={128}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition-colors hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
              aria-label={
                passwordVisible ? "Parolayı gizle" : "Parolayı göster"
              }
              aria-pressed={passwordVisible}
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              {passwordVisible ? (
                <LoginEyeOffIcon className="h-[18px] w-[18px]" />
              ) : (
                <LoginEyeIcon className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>
      </div>

      <button
        className="mt-7 flex h-[50px] w-full items-center justify-center gap-2 rounded-md bg-brand-magenta text-sm font-semibold text-white transition-colors hover:bg-brand-magenta-hover focus:outline-none focus:ring-2 focus:ring-brand-magenta/30 focus:ring-offset-2"
        type="submit"
      >
        Oturum Aç
        <LoginArrowIcon className="h-4 w-4" />
      </button>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <LoginShieldIcon className="h-4 w-4 text-zinc-300" />
        <p className="max-w-[16rem] text-xs leading-relaxed text-zinc-400">
          Güvenli yönetici erişimi
        </p>
      </div>
    </form>
  );
}
