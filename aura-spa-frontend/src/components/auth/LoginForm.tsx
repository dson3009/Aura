"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { authService } from "@/lib/services/auth.service";

interface LoginFormProps {
  onSwitchTab: (tab: "register") => void;
}

export default function LoginForm({ onSwitchTab }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [errEmail, setErrEmail] = useState(false);
  const [errPw, setErrPw] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [forgotStep, setForgotStep] = useState<"idle" | "forgot" | "otp" | "newpw" | "success">("idle");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [countdown, setCountdown] = useState(59);
  const [canResend, setCanResend] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();
  const { login } = useAuth();

  const clearErr = () => {
    setErrEmail(false);
    setErrPw(false);
    setLoginError("");
  };

  const resetForgotState = () => {
    setForgotStep("idle");
    setForgotEmail("");
    setForgotOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setForgotError("");
    setForgotNotice("");
    setCanResend(false);
    setCountdown(59);
  };

  const handleLogin = async () => {
    if (!email || !email.includes("@")) {
      setErrEmail(true);
      return;
    }
    if (!password) {
      setErrPw(true);
      return;
    }

    const result = await login(email, password);

    if (!result.success) {
      setErrPw(true);
      setLoginError(result.error ?? t("auth.invalidPassword"));
      return;
    }

    // AuthContext.login navigates to role dashboard by default.
    // Override with ?redirect param if present (e.g. /login?redirect=/booking).
    const redirectPath = new URLSearchParams(window.location.search).get("redirect");
    const storedSession = localStorage.getItem("auraspa_session");
    const role = storedSession ? (JSON.parse(storedSession) as { role?: string }).role : undefined;
    if (role === "customer" && redirectPath && redirectPath.startsWith("/")) {
      router.push(redirectPath);
    }
  };

  const handleLoginSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleLogin();
  };

  const startTimer = () => {
    setCountdown(59);
    setCanResend(false);
    let seconds = 59;
    const timer = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(timer);
        setCanResend(true);
      }
    }, 1000);
  };

  const requestPasswordReset = async () => {
    const normalizedEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setForgotError(t("auth.invalidEmail"));
      return;
    }

    try {
      setIsForgotLoading(true);
      setForgotError("");
      setForgotNotice("");
      await authService.forgotPassword(normalizedEmail);
      setForgotEmail(normalizedEmail);
      setForgotOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setForgotNotice(t("auth.otpSentIfExists"));
      setForgotStep("otp");
      startTimer();
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : t("auth.sendOtpFailed"));
    } finally {
      setIsForgotLoading(false);
    }
  };

  const submitPasswordReset = async () => {
    const otp = forgotOtp.trim();
    const passwordValue = newPassword.trim();

    if (!/^\d{6}$/.test(otp)) {
      setForgotError(t("auth.otpSixDigits"));
      setForgotStep("otp");
      return;
    }

    if (passwordValue.length < 8) {
      setForgotError(t("auth.newPasswordMinError"));
      return;
    }

    if (passwordValue !== confirmPassword) {
      setForgotError(t("auth.confirmPasswordMismatch"));
      return;
    }

    try {
      setIsForgotLoading(true);
      setForgotError("");
      await authService.resetPassword({ email: forgotEmail, otp, newPassword: passwordValue });
      setNewPassword("");
      setConfirmPassword("");
      setForgotOtp("");
      setForgotStep("success");
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : t("auth.resetPasswordFailed"));
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (forgotStep === "forgot") {
    return (
      <div className="stagger-up">
        <p className="label-sm text-on-surface-variant uppercase tracking-wider mb-1">{t("auth.forgotTitle")}</p>
        <h3 className="text-primary font-display mb-6" style={{ fontSize: 22 }}>{t("auth.recoverAccount")}</h3>
        <p className="text-on-surface-variant mb-6" style={{ fontSize: 14, lineHeight: 1.7 }}>
          {t("auth.recoverHint")}
        </p>
        <div className="mb-6">
          <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">Email</label>
          <input
            className="custom-input w-full"
            type="email"
            placeholder="example@auraspa.vn"
            value={forgotEmail}
            onChange={(event) => {
              setForgotEmail(event.target.value);
              setForgotError("");
              setForgotNotice("");
            }}
          />
        </div>
        {forgotError && <p style={{ fontSize: 12, color: "#ba1a1a", marginBottom: 12 }}>{forgotError}</p>}
        {forgotNotice && <p style={{ fontSize: 12, color: "#2d6a4f", marginBottom: 12 }}>{forgotNotice}</p>}
        <button className="btn-primary w-full mb-3 disabled:opacity-50" disabled={isForgotLoading} onClick={() => void requestPasswordReset()}>
          {isForgotLoading ? t("auth.sending") : t("auth.sendOtp")}
        </button>
        <button className="btn-ghost w-full" disabled={isForgotLoading} onClick={resetForgotState}>
          {t("auth.backToLogin")}
        </button>
      </div>
    );
  }
  if (forgotStep === "otp") {
    return (
      <div className="stagger-up">
        <p className="label-sm text-on-surface-variant uppercase tracking-wider mb-1">{t("auth.verifyOtp")}</p>
        <h3 className="text-primary font-display mb-3" style={{ fontSize: 22 }}>{t("auth.enterOtp")}</h3>
        <p className="text-on-surface-variant mb-6" style={{ fontSize: 14, lineHeight: 1.7 }}>
          {t("auth.otpSent")}<br /><strong className="text-on-surface">{forgotEmail || t("auth.yourEmail")}</strong>
        </p>
        <OtpBoxes value={forgotOtp} onChange={(value) => { setForgotOtp(value); setForgotError(""); }} />
        <div className="flex justify-between items-center mb-6" style={{ fontSize: 12, color: "#53433f" }}>
          {!canResend ? <span>{t("auth.resendAfter")} <strong>{countdown}s</strong></span> : <span />}
          {canResend && (
            <button
              className="text-primary font-semibold disabled:opacity-50"
              style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}
              disabled={isForgotLoading}
              onClick={() => void requestPasswordReset()}
            >
              {isForgotLoading ? t("auth.sending") : t("auth.resend")}
            </button>
          )}
        </div>
        {forgotError && <p style={{ fontSize: 12, color: "#ba1a1a", marginBottom: 12 }}>{forgotError}</p>}
        {forgotNotice && <p style={{ fontSize: 12, color: "#2d6a4f", marginBottom: 12 }}>{forgotNotice}</p>}
        <button
          className="btn-primary w-full mb-3 disabled:opacity-50"
          disabled={isForgotLoading}
          onClick={() => {
            if (!/^\d{6}$/.test(forgotOtp.trim())) {
              setForgotError(t("auth.otpSixDigits"));
              return;
            }
            setForgotError("");
            setForgotStep("newpw");
          }}
        >
          {t("auth.confirm")}
        </button>
        <button className="btn-ghost w-full" disabled={isForgotLoading} onClick={() => setForgotStep("forgot")}>
          {t("auth.back")}
        </button>
      </div>
    );
  }
  if (forgotStep === "newpw") {
    return (
      <div className="stagger-up">
        <p className="label-sm text-on-surface-variant uppercase tracking-wider mb-1">{t("auth.resetPassword")}</p>
        <h3 className="text-primary font-display mb-6" style={{ fontSize: 22 }}>{t("auth.newPassword")}</h3>
        <div className="space-y-5 mb-6">
          <div>
            <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">{t("auth.newPassword")}</label>
            <input
              className="custom-input w-full"
              type="password"
              placeholder={t("auth.minPassword")}
              value={newPassword}
              onChange={(event) => { setNewPassword(event.target.value); setForgotError(""); }}
            />
          </div>
          <div>
            <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1">{t("auth.confirmPassword")}</label>
            <input
              className="custom-input w-full"
              type="password"
              placeholder={t("auth.reenterPassword")}
              value={confirmPassword}
              onChange={(event) => { setConfirmPassword(event.target.value); setForgotError(""); }}
            />
          </div>
        </div>
        {forgotError && <p style={{ fontSize: 12, color: "#ba1a1a", marginBottom: 12 }}>{forgotError}</p>}
        <button className="btn-primary w-full disabled:opacity-50" disabled={isForgotLoading} onClick={() => void submitPasswordReset()}>
          {isForgotLoading ? t("auth.saving") : t("auth.savePassword")}
        </button>
      </div>
    );
  }
  if (forgotStep === "success") {
    return (
      <div className="stagger-up text-center py-4">
        <div className="check-circle mx-auto mb-5">
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: "#2d6a4f" }}>check</span>
        </div>
        <h3 className="text-primary font-display mb-2" style={{ fontSize: 22 }}>{t("auth.passwordChanged")}</h3>
        <p className="text-on-surface-variant mb-8" style={{ fontSize: 14, lineHeight: 1.7 }}>
          {t("auth.passwordChangedHint")}
        </p>
        <button className="btn-primary w-full" onClick={resetForgotState}>
          {t("auth.backToLoginPage")}
        </button>
      </div>
    );
  }
  return (
    <form className="stagger-up" onSubmit={handleLoginSubmit}>
      <div className="space-y-6 mb-6">
        {loginError && (
          <div className="flex items-center gap-2 rounded-lg px-4 py-3" style={{ background: "#ffdad6", fontSize: 12, color: "#93000a" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
            {loginError}
          </div>
        )}
        <div className="group">
          <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1 group-focus-within:text-primary transition-colors">
            {t("auth.emailOrUsername")}
          </label>
          <input
            className="custom-input w-full"
            type="email"
            placeholder="example@auraspa.vn"
            value={email}
            onChange={(event) => { setEmail(event.target.value); clearErr(); }}
          />
          {errEmail && <p style={{ fontSize: 12, color: "#ba1a1a", marginTop: 4 }}>{t("auth.invalidEmail")}</p>}
        </div>
        <div className="group">
          <label className="label-sm text-on-surface-variant uppercase tracking-wider block mb-1 group-focus-within:text-primary transition-colors">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              className="custom-input w-full"
              type={showPw ? "text" : "password"}
              placeholder="********"
              style={{ paddingRight: 36 }}
              value={password}
              onChange={(event) => { setPassword(event.target.value); clearErr(); }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              style={{ position: "absolute", right: 0, bottom: 12, background: "none", border: "none", cursor: "pointer", color: "#86736e" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{showPw ? "visibility_off" : "visibility"}</span>
            </button>
          </div>
          {errPw && <p style={{ fontSize: 12, color: "#ba1a1a", marginTop: 4 }}>{t("auth.invalidPassword")}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: "#713323" }} />
          <span className="text-on-surface-variant" style={{ fontSize: 12 }}>{t("auth.rememberMe")}</span>
        </label>
        <button
          type="button"
          onClick={() => setForgotStep("forgot")}
          className="text-primary"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 4 }}
        >
          {t("auth.forgotPassword")}
        </button>
      </div>
      <button type="submit" className="btn-primary w-full mb-6">{t("auth.loginNow")}</button>
      <div className="flex items-center gap-4 mb-6">
        <div style={{ height: 1, flex: 1, background: "rgba(217,193,188,0.5)" }} />
        <span style={{ fontSize: 12, color: "#86736e" }}>{t("auth.orContinueWith")}</span>
        <div style={{ height: 1, flex: 1, background: "rgba(217,193,188,0.5)" }} />
      </div>
      <div className="mb-6">
        <button type="button" className="btn-social w-full" onClick={authService.loginWithGoogle}>
          <GoogleIcon />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Google</span>
        </button>
      </div>
      <p className="text-center text-on-surface-variant" style={{ fontSize: 14 }}>
        {t("auth.noAccount")}{" "}
        <button
          type="button"
          onClick={() => onSwitchTab("register")}
          className="text-primary font-semibold"
          style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          {t("auth.registerNow")}
        </button>
      </p>
    </form>
  );
}

interface OtpBoxesProps {
  value: string;
  onChange: (value: string) => void;
}

function OtpBoxes({ value, onChange }: OtpBoxesProps) {
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  const setDigit = (raw: string, index: number) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = digit;
    onChange(nextDigits.join(""));

    if (digit) {
      const next = document.querySelectorAll<HTMLInputElement>(".otp-box")[index + 1];
      if (next) next.focus();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === "Backspace" && !event.currentTarget.value) {
      const nextDigits = [...digits];
      nextDigits[Math.max(0, index - 1)] = "";
      onChange(nextDigits.join(""));

      const prev = document.querySelectorAll<HTMLInputElement>(".otp-box")[index - 1];
      if (prev) prev.focus();
    }
  };

  return (
    <div className="flex gap-2 mb-4">
      {digits.map((digit, index) => (
        <input
          key={index}
          className="otp-box"
          maxLength={1}
          type="text"
          inputMode="numeric"
          value={digit}
          onChange={(event) => setDigit(event.target.value, index)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        />
      ))}
    </div>
  );
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

