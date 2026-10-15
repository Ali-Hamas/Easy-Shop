export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & { name: string };
export type AuthResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: string;
      message: string;
    };
export type ForgotPasswordInput = { email: string };
export type VerifyOtpInput = { email: string; otp: string };
export type ResetPasswordInput = {
  email: string;
  resetToken: string;
  password: string;
};

export type ForgotPasswordResult =
  | {
      ok: true;
      message: string;
      email: string;
      expiresInSeconds: number;
      resendAvailableInSeconds: number;
      devOtp?: string;
    }
  | { ok: false; code: string; message: string; retryAfter?: number };

export type VerifyOtpResult =
  | { ok: true; message: string; resetToken: string }
  | {
      ok: false;
      code: string;
      message: string;
      remainingAttempts?: number;
    };

export type ResetPasswordResult =
  | {
      ok: true;
      message: string;
      user?: { id: string; name: string; email: string };
    }
  | { ok: false; code: string; message: string };

/** A future adapter must use server-managed sessions, never browser-stored passwords. */
export interface AuthService {
  login(input: LoginInput): Promise<AuthResult>;
  register(input: RegisterInput): Promise<AuthResult>;
  forgotPassword(input: ForgotPasswordInput): Promise<ForgotPasswordResult>;
  verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult>;
  resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult>;
}

export type AuthSession = {
  user: { id: string; name: string; email: string };
  shops: {
    id: string;
    displayName: string;
    subdomain: string;
    status: "draft" | "launched";
  }[];
};
