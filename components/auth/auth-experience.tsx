"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearShopSelection } from "./session-provider";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  motion,
  MotionConfig,
  useAnimate,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Layers2,
  Mail,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { authService } from "@/services/auth";
import type { AuthResult, AuthService } from "@/types/auth";

type ForgotStep = "email" | "otp" | "reset" | null;

export default function AuthExperience({
  mode,
  service = authService,
}: {
  mode: "login" | "register";
  service?: AuthService;
}) {
  const router = useRouter();
  const register = mode === "register";
  const reduced = useReducedMotion();
  const [scope, animate] = useAnimate();

  useEffect(() => {
    if (!reduced)
      void animate(
        scope.current,
        { opacity: [0.6, 1], y: [12, 0] },
        { duration: 0.3 },
      );
  }, [animate, reduced, scope]);

  // Auth form state
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AuthResult | null>(null);
  const notice = useRef<HTMLDivElement>(null);

  // Forgot password & OTP state
  const [forgotStep, setForgotStep] = useState<ForgotStep>(null);
  const [sentEmail, setSentEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | undefined>();

  // 1-minute countdown timer for resend option
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Standard Login / Register submit
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    const next: Record<string, string> = {};

    if (register && !name) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email address.";
    if (!password) next.password = "Enter your password.";
    if (register && (password.length < 12 || password.length > 128))
      next.password = "Use 12–128 characters for your password.";
    if (register && password !== String(data.get("confirm") ?? ""))
      next.confirm = "Passwords do not match.";

    setErrors(next);
    setResult(null);

    if (Object.keys(next).length) {
      (
        form.elements.namedItem(Object.keys(next)[0]) as HTMLInputElement
      )?.focus();
      return;
    }

    setBusy(true);
    try {
      const response = await (register
        ? service.register({ name, email, password })
        : service.login({ email, password }));
      setResult(response);
      if (response.ok) {
        clearShopSelection();
        router.replace(register ? "/onboarding" : "/dashboard");
        router.refresh();
      }
    } catch {
      setResult({
        ok: false,
        code: "NETWORK",
        message: "Account access could not be reached. Please try again.",
      });
    } finally {
      setBusy(false);
      setVisible(false);
      const passEl = form.elements.namedItem("password") as HTMLInputElement;
      if (passEl) passEl.value = "";
      if (register) {
        const confEl = form.elements.namedItem("confirm") as HTMLInputElement;
        if (confEl) confEl.value = "";
      }
      requestAnimationFrame(() => notice.current?.focus());
    }
  }

  // Step 1: Send OTP to Email
  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }

    setErrors({});
    setResult(null);
    setBusy(true);

    try {
      const response = await service.forgotPassword({ email });
      if (response.ok) {
        setSentEmail(email);
        setForgotStep("otp");
        setOtpValue("");
        setResendCountdown(60); // 1-minute countdown
        setDevOtp(response.devOtp);
        if (typeof window !== "undefined" && response.devOtp) {
          (window as unknown as { __DEV_OTP__?: string }).__DEV_OTP__ =
            response.devOtp;
        }
        setResult({
          ok: true,
          message:
            "A 6-digit verification code has been sent. It is valid for 10 minutes.",
        });
      } else {
        setResult({
          ok: false,
          code: response.code,
          message: response.message,
        });
        if (response.retryAfter && response.retryAfter > 0) {
          setResendCountdown(response.retryAfter);
        }
      }
    } catch {
      setResult({
        ok: false,
        code: "NETWORK",
        message: "Service could not be reached. Please try again.",
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }

  // Resend OTP
  async function handleResendCode() {
    if (resendCountdown > 0 || busy || !sentEmail) return;
    setBusy(true);
    setResult(null);

    try {
      const response = await service.forgotPassword({ email: sentEmail });
      if (response.ok) {
        setResendCountdown(60); // Reset 1-minute countdown
        setDevOtp(response.devOtp);
        if (typeof window !== "undefined" && response.devOtp) {
          (window as unknown as { __DEV_OTP__?: string }).__DEV_OTP__ =
            response.devOtp;
        }
        setResult({
          ok: true,
          message:
            "A new verification code has been sent. It is valid for 10 minutes.",
        });
      } else {
        setResult({
          ok: false,
          code: response.code,
          message: response.message,
        });
        if (response.retryAfter && response.retryAfter > 0) {
          setResendCountdown(response.retryAfter);
        }
      }
    } catch {
      setResult({
        ok: false,
        code: "NETWORK",
        message: "Could not resend verification code. Please try again.",
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }

  // Step 2: Verify OTP
  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const cleanOtp = otpValue.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      setErrors({ otp: "Enter the 6-digit verification code." });
      return;
    }

    setErrors({});
    setResult(null);
    setBusy(true);

    try {
      const response = await service.verifyOtp({
        email: sentEmail,
        otp: cleanOtp,
      });
      if (response.ok) {
        setResetToken(response.resetToken);
        setForgotStep("reset");
        setResult(null);
      } else {
        setResult({
          ok: false,
          code: response.code,
          message: response.message,
        });
      }
    } catch {
      setResult({
        ok: false,
        code: "NETWORK",
        message: "Verification service could not be reached. Please try again.",
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }

  // Step 3: Set New Password
  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    const confirm = String(data.get("confirm") ?? "");
    const next: Record<string, string> = {};

    if (!password) next.password = "Enter your new password.";
    if (password.length < 12 || password.length > 128)
      next.password = "Use 12–128 characters for your password.";
    if (password !== confirm) next.confirm = "Passwords do not match.";

    setErrors(next);
    setResult(null);

    if (Object.keys(next).length) {
      (
        form.elements.namedItem(Object.keys(next)[0]) as HTMLInputElement
      )?.focus();
      return;
    }

    setBusy(true);

    try {
      const response = await service.resetPassword({
        email: sentEmail,
        resetToken,
        password,
      });
      if (response.ok) {
        clearShopSelection();
        setResult({
          ok: true,
          message:
            "Your password has been reset successfully. Opening your workspace…",
        });
        setTimeout(() => {
          router.replace("/dashboard");
          router.refresh();
        }, 1200);
      } else {
        setResult({
          ok: false,
          code: response.code,
          message: response.message,
        });
      }
    } catch {
      setResult({
        ok: false,
        code: "NETWORK",
        message: "Could not reset password. Please try again.",
      });
    } finally {
      setBusy(false);
      setVisible(false);
      requestAnimationFrame(() => notice.current?.focus());
    }
  }

  function field(
    id: string,
    label: string,
    type: string,
    autoComplete: string,
    extraHeader?: React.ReactNode,
    defaultValue?: string,
  ) {
    return (
      <div className="auth-field">
        {extraHeader ? (
          extraHeader
        ) : (
          <label htmlFor={id}>{label}</label>
        )}
        <div className="auth-input-wrap">
          <input
            id={id}
            name={id}
            type={
              id === "password" || id === "confirm"
                ? visible
                  ? "text"
                  : "password"
                : type
            }
            autoComplete={autoComplete}
            defaultValue={defaultValue}
            aria-invalid={!!errors[id]}
            aria-describedby={errors[id] ? `${id}-error` : undefined}
            disabled={busy}
            required
          />
          {(id === "password" || id === "confirm") && (
            <button
              type="button"
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {errors[id] && (
          <p className="auth-field-error" id={`${id}-error`}>
            {errors[id]}
          </p>
        )}
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`auth-site auth-studio ${register ? "auth-registration" : "auth-login"}`}
      >
        <header className="auth-header">
          <Link className="launch-brand" href="/" aria-label="Easy Shop home">
            <Layers2 size={24} />
            <span>easy shop.</span>
          </Link>
          <Link href="/" className="launch-link">
            <ArrowLeft size={15} /> Back to the product
          </Link>
        </header>

        <main className="auth-layout">
          <aside className="auth-editorial">
            <span className="auth-chapter">
              {register ? "01" : forgotStep ? "↻" : "↳"}
            </span>
            <p>
              {register
                ? "Start with you.\nThen make it yours."
                : forgotStep
                  ? "Recover your access.\nQuick and secure."
                  : "Your working day,\nready when you are."}
            </p>
            {register ? (
              <ol className="auth-journey" aria-label="Your setup journey">
                <li aria-current="step">
                  <span>01</span> Your account <small>Start here</small>
                </li>
                <li>
                  <span>02</span> Your shop
                </li>
                <li>
                  <span>03</span> Your first product
                </li>
                <li>
                  <span>04</span> Your storefront
                </li>
              </ol>
            ) : forgotStep ? (
              <div className="auth-quiet-note">
                <KeyRound size={20} />
                <span>
                  Password recovery.
                  <br />
                  Verified via secure 6-digit code.
                </span>
              </div>
            ) : (
              <div className="auth-quiet-note">
                <ShieldCheck size={20} />
                <span>
                  A little assistance.
                  <br />
                  Your judgment, always.
                </span>
              </div>
            )}
          </aside>

          <motion.section
            ref={scope}
            className="auth-form-panel"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0 : 0.24 }}
          >
            {/* ===================================================
                VIEW 1: FORGOT PASSWORD - STEP 1 (ASK EMAIL)
                =================================================== */}
            {forgotStep === "email" ? (
              <>
                <div className="auth-form-heading">
                  <span className="auth-step-kicker">Account recovery</span>
                  <h1>Forgot password?</h1>
                  <p>
                    Enter your email address and we’ll send you a 6-digit
                    verification code.
                  </p>
                </div>

                <div className="auth-availability">
                  <Mail size={17} />
                  <p>
                    Verification code delivery.
                    <span>
                      Codes are valid for 10 minutes. A resend option is available
                      after 1 minute.
                    </span>
                  </p>
                </div>

                <form noValidate onSubmit={handleSendOtp} aria-busy={busy}>
                  {field(
                    "email",
                    "Email address",
                    "email",
                    "email",
                    undefined,
                    sentEmail,
                  )}

                  <div
                    ref={notice}
                    tabIndex={-1}
                    className={
                      result
                        ? `auth-result ${result.ok ? "auth-success" : "auth-error"}`
                        : ""
                    }
                    role="status"
                  >
                    {result && (
                      <>
                        <span>
                          {result.ok ? (
                            <Check size={18} />
                          ) : (
                            <ShieldCheck size={18} />
                          )}
                        </span>
                        <p>{result.message}</p>
                      </>
                    )}
                  </div>

                  <button
                    className="launch-button auth-submit"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? "Sending code…" : "Send verification code"}
                    {!busy && <ArrowUpRight size={17} />}
                  </button>
                </form>

                <button
                  type="button"
                  className="auth-back-button"
                  onClick={() => {
                    setForgotStep(null);
                    setResult(null);
                    setErrors({});
                  }}
                >
                  <ArrowLeft size={14} /> Back to log in
                </button>
              </>
            ) : forgotStep === "otp" ? (
              /* ===================================================
                 VIEW 2: FORGOT PASSWORD - STEP 2 (ENTER & VERIFY OTP)
                 =================================================== */
              <>
                <div className="auth-form-heading">
                  <span className="auth-step-kicker">Step 2 of 3</span>
                  <h1>Check your email</h1>
                  <p>
                    We sent a 6-digit verification code to{" "}
                    <strong>{sentEmail}</strong>. The code is valid for 10
                    minutes.
                  </p>
                </div>

                <div className="auth-availability">
                  <ShieldCheck size={17} />
                  <p>
                    Code validity & security.
                    <span>
                      Valid for 10 minutes. Resend code is available after 1
                      minute.
                    </span>
                  </p>
                </div>

                <form
                  noValidate
                  onSubmit={handleVerifyOtp}
                  aria-busy={busy}
                  data-dev-otp={devOtp}
                >
                  <div className="auth-field">
                    <label htmlFor="otp">Verification code</label>
                    <div className="auth-input-wrap">
                      <input
                        id="otp"
                        name="otp"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="••••••"
                        className="auth-otp-input"
                        value={otpValue}
                        onChange={(e) => {
                          const val = e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6);
                          setOtpValue(val);
                        }}
                        disabled={busy}
                        required
                        aria-invalid={!!errors.otp}
                        aria-describedby={
                          errors.otp ? "otp-error" : undefined
                        }
                      />
                    </div>
                    {errors.otp && (
                      <p className="auth-field-error" id="otp-error">
                        {errors.otp}
                      </p>
                    )}
                  </div>

                  <div
                    ref={notice}
                    tabIndex={-1}
                    className={
                      result
                        ? `auth-result ${result.ok ? "auth-success" : "auth-error"}`
                        : ""
                    }
                    role="status"
                  >
                    {result && (
                      <>
                        <span>
                          {result.ok ? (
                            <Check size={18} />
                          ) : (
                            <ShieldCheck size={18} />
                          )}
                        </span>
                        <p>{result.message}</p>
                      </>
                    )}
                  </div>

                  <button
                    className="launch-button auth-submit"
                    type="submit"
                    disabled={busy || otpValue.length !== 6}
                  >
                    {busy ? "Verifying code…" : "Verify code"}
                    {!busy && <ArrowUpRight size={17} />}
                  </button>

                  <div className="auth-resend-row">
                    <span className="auth-resend-prompt">
                      Didn’t receive the code?
                    </span>
                    <button
                      type="button"
                      disabled={resendCountdown > 0 || busy}
                      onClick={handleResendCode}
                      className="auth-resend-button"
                    >
                      {resendCountdown > 0
                        ? `Resend code in ${resendCountdown}s`
                        : "Resend code"}
                    </button>
                  </div>
                </form>

                <button
                  type="button"
                  className="auth-secondary-action"
                  onClick={() => {
                    setForgotStep("email");
                    setResult(null);
                    setErrors({});
                    setOtpValue("");
                  }}
                >
                  <RotateCcw size={14} /> Use a different email
                </button>
              </>
            ) : forgotStep === "reset" ? (
              /* ===================================================
                 VIEW 3: FORGOT PASSWORD - STEP 3 (SET NEW PASSWORD)
                 =================================================== */
              <>
                <div className="auth-form-heading">
                  <span className="auth-step-kicker">Step 3 of 3</span>
                  <h1>Create new password</h1>
                  <p>
                    Choose a secure password with 12–128 characters for{" "}
                    <strong>{sentEmail}</strong>.
                  </p>
                </div>

                <div className="auth-availability">
                  <ShieldCheck size={17} />
                  <p>
                    Account secured.
                    <span>
                      Your new password will replace your previous credentials.
                    </span>
                  </p>
                </div>

                <form
                  noValidate
                  onSubmit={handleResetPassword}
                  aria-busy={busy}
                >
                  {field(
                    "password",
                    "New password",
                    "password",
                    "new-password",
                  )}
                  {field(
                    "confirm",
                    "Confirm new password",
                    "password",
                    "new-password",
                  )}

                  <div
                    ref={notice}
                    tabIndex={-1}
                    className={
                      result
                        ? `auth-result ${result.ok ? "auth-success" : "auth-error"}`
                        : ""
                    }
                    role="status"
                  >
                    {result && (
                      <>
                        <span>
                          {result.ok ? (
                            <Check size={18} />
                          ) : (
                            <ShieldCheck size={18} />
                          )}
                        </span>
                        <p>{result.message}</p>
                      </>
                    )}
                  </div>

                  <button
                    className="launch-button auth-submit"
                    type="submit"
                    disabled={busy}
                  >
                    {busy
                      ? "Updating password…"
                      : "Update password & sign in"}
                    {!busy && <ArrowUpRight size={17} />}
                  </button>
                </form>
              </>
            ) : (
              /* ===================================================
                 STANDARD LOGIN / REGISTER VIEW
                 =================================================== */
              <>
                <div className="auth-form-heading">
                  <span className="launch-kicker">
                    {register ? "Your next chapter" : "Your shop, in focus"}
                  </span>
                  <h1>
                    {register
                      ? "First, a place\nto call yours."
                      : "Welcome back."}
                  </h1>
                  <p>
                    {register
                      ? "A thoughtful start for your next working day."
                      : "Pick up where your working day left off."}
                  </p>
                </div>

                <div className="auth-availability">
                  <ShieldCheck size={17} />
                  <p>
                    Your account stays protected.
                    <span>
                      Secure sign-in. Your shop is accessible only to your
                      account.
                    </span>
                  </p>
                </div>

                <form noValidate onSubmit={submit} aria-busy={busy}>
                  {register && field("name", "Your name", "text", "name")}
                  {field("email", "Email address", "email", "email")}
                  {field(
                    "password",
                    "Password",
                    "password",
                    register ? "new-password" : "current-password",
                    !register ? (
                      <div className="auth-field-header">
                        <label htmlFor="password">Password</label>
                        <button
                          type="button"
                          className="auth-forgot-link"
                          onClick={() => {
                            setForgotStep("email");
                            setResult(null);
                            setErrors({});
                          }}
                        >
                          Forgot password?
                        </button>
                      </div>
                    ) : undefined,
                  )}
                  {register &&
                    field(
                      "confirm",
                      "Confirm password",
                      "password",
                      "new-password",
                    )}

                  <div
                    ref={notice}
                    tabIndex={-1}
                    className={
                      result
                        ? `auth-result ${result.ok ? "auth-success" : "auth-error"}`
                        : ""
                    }
                    role="status"
                  >
                    {result && (
                      <>
                        <span>
                          {result.ok ? (
                            <Check size={18} />
                          ) : (
                            <ShieldCheck size={18} />
                          )}
                        </span>
                        <p>{result.message}</p>
                      </>
                    )}
                  </div>

                  <button
                    className="launch-button auth-submit"
                    type="submit"
                    disabled={busy || result?.ok}
                  >
                    {busy
                      ? "Please wait…"
                      : register
                        ? "Create account"
                        : "Log in"}
                    {!busy && <ArrowUpRight size={17} />}
                  </button>
                </form>

                <p className="auth-switch">
                  {register
                    ? "Already have an account?"
                    : "New to Easy Shop?"}{" "}
                  <Link href={register ? "/login" : "/register"}>
                    {register ? "Log in" : "Get started"}
                  </Link>
                </p>

                <Link href="/dashboard" className="auth-preview-link">
                  Open your workspace <ArrowUpRight size={14} />
                </Link>
              </>
            )}
          </motion.section>
        </main>

        <footer className="auth-footer">
          <span>Easy Shop · Social commerce, considered.</span>
          <span>Your shop. Your workspace.</span>
        </footer>
      </div>
    </MotionConfig>
  );
}
