import type {
  AuthResult,
  AuthService,
  ForgotPasswordInput,
  ForgotPasswordResult,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ResetPasswordResult,
  VerifyOtpInput,
  VerifyOtpResult,
} from "@/types/auth";

async function submit(
  action: string,
  input?: LoginInput | RegisterInput,
): Promise<AuthResult> {
  try {
    const response = await fetch(`/api/commerce/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    return response.ok
      ? {
          ok: true,
          message:
            action === "logout"
              ? "You are logged out."
              : "You're signed in. Opening your workspace…",
        }
      : {
          ok: false,
          code: data.code ?? "REQUEST_FAILED",
          message: data.message ?? "Account access could not be completed.",
        };
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Account access could not be reached. Please try again.",
    };
  }
}

async function forgotPasswordRequest(
  input: ForgotPasswordInput,
): Promise<ForgotPasswordResult> {
  try {
    const response = await fetch("/api/commerce/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (response.ok) {
      return {
        ok: true,
        message: data.message ?? "Verification code sent to your email.",
        email: data.email ?? input.email,
        expiresInSeconds: data.expiresInSeconds ?? 600,
        resendAvailableInSeconds: data.resendAvailableInSeconds ?? 60,
        devOtp: data.devOtp,
      };
    }
    return {
      ok: false,
      code: data.code ?? "REQUEST_FAILED",
      message: data.message ?? "Could not send verification code.",
      retryAfter: data.retryAfter,
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Account service could not be reached. Please try again.",
    };
  }
}

async function verifyOtpRequest(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  try {
    const response = await fetch("/api/commerce/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (response.ok) {
      return {
        ok: true,
        message: data.message ?? "Code verified successfully.",
        resetToken: data.resetToken,
      };
    }
    return {
      ok: false,
      code: data.code ?? "REQUEST_FAILED",
      message: data.message ?? "Verification failed.",
      remainingAttempts: data.remainingAttempts,
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Account service could not be reached. Please try again.",
    };
  }
}

async function resetPasswordRequest(
  input: ResetPasswordInput,
): Promise<ResetPasswordResult> {
  try {
    const response = await fetch("/api/commerce/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      credentials: "same-origin",
      signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (response.ok) {
      return {
        ok: true,
        message: data.message ?? "Password updated successfully.",
        user: data.user,
      };
    }
    return {
      ok: false,
      code: data.code ?? "REQUEST_FAILED",
      message: data.message ?? "Password reset could not be completed.",
    };
  } catch {
    return {
      ok: false,
      code: "NETWORK",
      message: "Account service could not be reached. Please try again.",
    };
  }
}

export const authService: AuthService = {
  login: (input) => submit("login", input),
  register: (input) => submit("register", input),
  forgotPassword: forgotPasswordRequest,
  verifyOtp: verifyOtpRequest,
  resetPassword: resetPasswordRequest,
};
export const logout = () => submit("logout");
