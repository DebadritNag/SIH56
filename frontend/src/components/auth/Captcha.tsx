"use client";

import { forwardRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

import { config } from "@/lib/config";

interface CaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

/**
 * hCaptcha checkbox widget for auth forms. Renders only when a sitekey is configured
 * (NEXT_PUBLIC_HCAPTCHA_SITEKEY); otherwise returns null so local dev without a sitekey
 * still works. The dark theme matches the auth shell.
 *
 * The resulting token is passed to onVerify — callers forward it to Supabase's
 * `captchaToken` option and/or the backend /auth/verify-captcha endpoint.
 */
export const Captcha = forwardRef<HCaptcha, CaptchaProps>(function Captcha(
  { onVerify, onExpire, onError },
  ref,
) {
  if (!config.hcaptchaSitekey) return null;

  return (
    <div className="flex justify-center">
      <HCaptcha
        ref={ref}
        sitekey={config.hcaptchaSitekey}
        theme="dark"
        onVerify={onVerify}
        onExpire={onExpire}
        onError={onError}
      />
    </div>
  );
});

/** True when the captcha widget is active (sitekey configured). */
export const captchaEnabled = (): boolean => Boolean(config.hcaptchaSitekey);
