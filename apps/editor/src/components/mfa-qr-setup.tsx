"use client";

import { useEffect, useId, useState } from "react";
import QRCode from "qrcode";

type MfaQrSetupProps = {
  otpauthUri: string;
  secret: string;
  accountLabel: string;
};

export function MfaQrSetup({ otpauthUri, secret, accountLabel }: MfaQrSetupProps) {
  const secretId = useId();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(otpauthUri, {
      margin: 1,
      width: 220,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrError("QR kodu oluşturulamadı. Aşağıdaki gizli anahtarı kullanın.");
          setQrDataUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [otpauthUri]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Authenticator uygulamanızla <span className="font-medium text-zinc-900">{accountLabel}</span> hesabı için QR kodu tarayın veya gizli anahtarı elle girin.
      </p>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[220px] w-[220px] shrink-0 items-center justify-center border border-zinc-200 bg-white p-2">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL from qrcode
            <img
              src={qrDataUrl}
              alt="Authenticator kurulum QR kodu"
              width={220}
              height={220}
              className="h-auto w-full"
            />
          ) : (
            <p className="px-3 text-center text-xs text-zinc-500">
              {qrError ?? "QR kodu hazırlanıyor…"}
            </p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Gizli anahtar
          </p>
          <p
            id={secretId}
            className="mt-2 break-all font-mono text-sm text-zinc-900"
          >
            {secret}
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Bu anahtar yalnızca kurulum sırasında gösterilir ve daha sonra tekrar görüntülenemez.
          </p>
        </div>
      </div>
    </div>
  );
}
