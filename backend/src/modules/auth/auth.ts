import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { MongoServerError } from "mongodb";
import { z } from "zod";
import { connectDb, transaction } from "../../shared/db.js";
import { config } from "../../shared/config.js";

const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
export const SESSION_COOKIE = "easy_shop_session";
const lifetime = 7 * 24 * 60 * 60;
type User = {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  language: "en";
  createdAt: string;
};
type Session = {
  _id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
};
type PasswordResetOtp = {
  _id?: string;
  email: string;
  otpHash: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  resetTokenHash?: string;
  resetExpiresAt?: Date;
  devOtp?: string;
};
export const actorContext = new AsyncLocalStorage<{ actorId: string }>();
export const currentActor = () => actorContext.getStore()?.actorId ?? "system";
declare module "fastify" {
  interface FastifyRequest {
    authUser?: { id: string; name: string; email: string };
  }
}
const publicUser = (user: User) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function sessionToken(request: FastifyRequest) {
  const token = request.headers.cookie
    ?.split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function cookie(token: string, age = lifetime) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${config.appOrigin.startsWith("https:") ? "; Secure" : ""}`;
}
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
async function verifyPassword(password: string, stored?: string) {
  const parts = stored?.split("$");
  const valid =
    parts?.length === 3 &&
    parts[0] === "scrypt" &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  // Always perform the same expensive derivation, including unknown accounts.
  const hash = await derive(password, valid ? parts[1] : "0".repeat(32));
  return Boolean(valid && timingSafeEqual(hash, Buffer.from(parts![2], "hex")));
}
async function resolveSession(request: FastifyRequest) {
  const token = sessionToken(request);
  if (!token) return null;
  const db = await connectDb();
  const session = await db
    .collection<Session>("authSessions")
    .findOne({ _id: digest(token), expiresAt: { $gt: new Date() } });
  return session
    ? db.collection<User>("users").findOne({ _id: session.userId })
    : null;
}
export function installAuth(app: FastifyInstance) {
  app.addHook("onRequest", (_request, _reply, done) =>
    actorContext.run({ actorId: "anonymous" }, done),
  );
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0];
    const protectedRoute =
      /^\/api\/v1\/(onboarding|inventory|customers|inbox|dashboard)(\/|$)/.test(
        path,
      );
    const authRoute = path.startsWith("/api/v1/auth/");
    if (!protectedRoute && !authRoute) return;
    reply.header("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin !== config.appOrigin
    ) {
      return reply
        .code(403)
        .send({
          code: "ORIGIN_REJECTED",
          message: "Use the application to submit this request.",
        });
    }
    const user = await resolveSession(request);
    if (user) {
      request.authUser = publicUser(user);
      const context = actorContext.getStore();
      if (context) context.actorId = user._id;
    }
    if (!protectedRoute) return;
    if (!user)
      return reply
        .code(401)
        .send({ code: "AUTH_REQUIRED", message: "Log in to continue." });
    const shopId = (request.params as { shopId?: string }).shopId;
    if (shopId) {
      if (!z.string().uuid().safeParse(shopId).success) return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Invalid shop identifier." });
      const db = await connectDb();
      if (
        !(await db
          .collection("shops")
          .findOne(
            { _id: shopId as never, ownerId: user._id },
            { projection: { _id: 1 } },
          ))
      ) {
        return reply
          .code(404)
          .send({ code: "SHOP_NOT_FOUND", message: "Shop not found." });
      }
    }
  });
}
export async function registerAuthRoutes(app: FastifyInstance) {
  const loginSchema = z
    .object({
      email: z
        .string()
        .trim()
        .email()
        .max(254)
        .transform((v) => v.toLowerCase()),
      password: z.string().min(1).max(128),
    })
    .strict();
  const registerSchema = loginSchema.extend({
    name: z.string().trim().min(2).max(100),
    password: z.string().min(12).max(128),
  });
  const forgotPasswordSchema = z
    .object({
      email: z
        .string()
        .trim()
        .email("Enter a valid email address.")
        .max(254)
        .transform((v) => v.toLowerCase()),
    })
    .strict();
  const verifyOtpSchema = z
    .object({
      email: z
        .string()
        .trim()
        .email("Enter a valid email address.")
        .max(254)
        .transform((v) => v.toLowerCase()),
      otp: z
        .string()
        .trim()
        .regex(/^\d{6}$/, "Enter the 6-digit verification code."),
    })
    .strict();
  const resetPasswordSchema = z
    .object({
      email: z
        .string()
        .trim()
        .email("Enter a valid email address.")
        .max(254)
        .transform((v) => v.toLowerCase()),
      resetToken: z.string().min(32).max(128),
      password: z
        .string()
        .min(12, "Use 12–128 characters for your password.")
        .max(128),
    })
    .strict();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0]?.message;
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message:
          firstIssue && firstIssue !== "Required"
            ? firstIssue
            : "Check your submitted fields and try again.",
        issues: error.issues,
      });
    }
    throw error;
  });
  for (const action of ["register", "login"] as const) {
    app.post(
      `/${action}`,
      { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
      async (request, reply) => {
        const input =
          action === "register"
            ? registerSchema.parse(request.body)
            : loginSchema.parse(request.body);
        const db = await connectDb();
        let user = await db
          .collection<User>("users")
          .findOne({ email: input.email });
        if (action === "register" && user)
          return reply
            .code(409)
            .send({
              code: "ACCOUNT_EXISTS",
              message:
                "An account already uses this email. Log in with your existing credentials.",
            });
        if (
          action === "login" &&
          !(await verifyPassword(input.password, user?.passwordHash))
        )
          return reply
            .code(401)
            .send({
              code: "INVALID_CREDENTIALS",
              message: "Email or password is incorrect.",
            });
        const newUser =
          action === "register"
            ? {
                _id: randomUUID(),
                name: (input as z.infer<typeof registerSchema>).name,
                email: input.email,
                passwordHash: await hashPassword(input.password),
                language: "en" as const,
                createdAt: new Date().toISOString(),
              }
            : null;
        user = newUser ?? user;
        if (!user)
          return reply
            .code(401)
            .send({
              code: "INVALID_CREDENTIALS",
              message: "Email or password is incorrect.",
            });
        const token = randomBytes(32).toString("hex");
        const old = sessionToken(request);
        try {
          await transaction(async (database, session) => {
            if (newUser)
              await database
                .collection<User>("users")
                .insertOne(newUser, { session });
            if (old)
              await database
                .collection<Session>("authSessions")
                .deleteOne({ _id: digest(old) }, { session });
            await database
              .collection<Session>("authSessions")
              .insertOne(
                {
                  _id: digest(token),
                  userId: user!._id,
                  createdAt: new Date(),
                  expiresAt: new Date(Date.now() + lifetime * 1000),
                },
                { session },
              );
          });
        } catch (error) {
          if (error instanceof MongoServerError && error.code === 11000)
            return reply
              .code(409)
              .send({
                code: "ACCOUNT_EXISTS",
                message: "An account already uses this email.",
              });
          throw error;
        }
        return reply
          .code(action === "register" ? 201 : 200)
          .header("Set-Cookie", cookie(token))
          .send({ user: publicUser(user) });
      },
    );
  }

  const forgotPasswordHandler = async (
    request: FastifyRequest,
    reply: import("fastify").FastifyReply,
  ) => {
    const input = forgotPasswordSchema.parse(request.body);
    const db = await connectDb();
    const user = await db
      .collection<User>("users")
      .findOne({ email: input.email });
    if (!user) {
      return reply.code(404).send({
        code: "ACCOUNT_NOT_FOUND",
        message: "No account found with this email address.",
      });
    }

    // 1-minute rate-limit cooldown
    const existing = await db
      .collection<PasswordResetOtp>("passwordResetOtps")
      .findOne({ email: input.email });
    if (existing && Date.now() - existing.createdAt.getTime() < 60 * 1000) {
      const waitSeconds = Math.ceil(
        (60 * 1000 - (Date.now() - existing.createdAt.getTime())) / 1000,
      );
      return reply.code(429).send({
        code: "RATE_LIMITED",
        message: `Please wait ${waitSeconds} seconds before requesting a new code.`,
        retryAfter: waitSeconds,
      });
    }

    // 6-digit numeric OTP valid for 10 minutes
    const otp = randomInt(100000, 1000000).toString();
    const createdAt = new Date();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.collection<PasswordResetOtp>("passwordResetOtps").updateOne(
      { email: input.email },
      {
        $set: {
          email: input.email,
          otpHash: digest(otp),
          createdAt,
          expiresAt,
          attempts: 0,
          verified: false,
          devOtp: config.nodeEnv !== "production" ? otp : undefined,
        },
        $unset: {
          resetTokenHash: "",
          resetExpiresAt: "",
        },
      },
      { upsert: true },
    );

    console.log(
      `\n==================================================\n[AUTH OTP] Password Reset Verification Code\nTo: ${input.email}\nCode: ${otp}\nValid for 10 minutes.\n==================================================\n`,
    );

    return reply.code(200).send({
      ok: true,
      message:
        "A 6-digit verification code has been sent to your email. It is valid for 10 minutes.",
      email: input.email,
      expiresInSeconds: 600,
      resendAvailableInSeconds: 60,
      ...(config.nodeEnv !== "production" ? { devOtp: otp } : {}),
    });
  };

  app.post("/forgot-password", forgotPasswordHandler);
  app.post("/forgot-password/request", forgotPasswordHandler);

  app.post("/verify-otp", async (request, reply) => {
    const input = verifyOtpSchema.parse(request.body);
    const db = await connectDb();
    const record = await db
      .collection<PasswordResetOtp>("passwordResetOtps")
      .findOne({ email: input.email });
    if (!record) {
      return reply.code(400).send({
        code: "OTP_NOT_FOUND",
        message:
          "No verification code was requested for this email. Please request a code first.",
      });
    }
    if (record.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({
        code: "OTP_EXPIRED",
        message:
          "This verification code has expired (codes are valid for 10 minutes). Please request a new code.",
      });
    }
    if (record.attempts >= 5) {
      return reply.code(429).send({
        code: "TOO_MANY_ATTEMPTS",
        message: "Too many incorrect attempts. Please request a new code.",
      });
    }
    const isMatch = timingSafeEqual(
      Buffer.from(digest(input.otp)),
      Buffer.from(record.otpHash),
    );
    if (!isMatch) {
      await db
        .collection<PasswordResetOtp>("passwordResetOtps")
        .updateOne({ email: input.email }, { $inc: { attempts: 1 } });
      return reply.code(400).send({
        code: "OTP_INVALID",
        message: "Incorrect verification code. Please check and try again.",
        remainingAttempts: Math.max(0, 4 - record.attempts),
      });
    }
    const resetToken = randomBytes(32).toString("hex");
    await db.collection<PasswordResetOtp>("passwordResetOtps").updateOne(
      { email: input.email },
      {
        $set: {
          verified: true,
          resetTokenHash: digest(resetToken),
          resetExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
    );
    return reply.code(200).send({
      ok: true,
      message: "Code verified successfully.",
      resetToken,
    });
  });

  app.post("/reset-password", async (request, reply) => {
    const input = resetPasswordSchema.parse(request.body);
    const db = await connectDb();
    const record = await db
      .collection<PasswordResetOtp>("passwordResetOtps")
      .findOne({ email: input.email });
    if (
      !record ||
      !record.verified ||
      !record.resetTokenHash ||
      !record.resetExpiresAt ||
      record.resetExpiresAt.getTime() < Date.now() ||
      !timingSafeEqual(
        Buffer.from(digest(input.resetToken)),
        Buffer.from(record.resetTokenHash),
      )
    ) {
      return reply.code(400).send({
        code: "RESET_TOKEN_INVALID",
        message:
          "Password reset session has expired or is invalid. Please request a new code.",
      });
    }
    const user = await db
      .collection<User>("users")
      .findOne({ email: input.email });
    if (!user) {
      return reply.code(404).send({
        code: "ACCOUNT_NOT_FOUND",
        message: "Account not found.",
      });
    }
    const newHash = await hashPassword(input.password);
    await db
      .collection<User>("users")
      .updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });
    await db
      .collection<PasswordResetOtp>("passwordResetOtps")
      .deleteOne({ email: input.email });
    await db
      .collection<Session>("authSessions")
      .deleteMany({ userId: user._id });
    const token = randomBytes(32).toString("hex");
    await db.collection<Session>("authSessions").insertOne({
      _id: digest(token),
      userId: user._id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + lifetime * 1000),
    });
    return reply
      .code(200)
      .header("Set-Cookie", cookie(token))
      .send({
        ok: true,
        message:
          "Your password has been reset successfully. Opening your workspace…",
        user: publicUser(user),
      });
  });

  app.get("/me", async (request, reply) => {
    if (!request.authUser)
      return reply
        .code(401)
        .send({ code: "AUTH_REQUIRED", message: "Log in to continue." });
    const db = await connectDb();
    const shops = await db
      .collection("shops")
      .find(
        { ownerId: request.authUser.id },
        { projection: { _id: 1, displayName: 1, status: 1, subdomain: 1 } },
      )
      .sort({ createdAt: -1 })
      .toArray();
    return {
      user: request.authUser,
      shops: shops.map(({ _id, ...shop }) => ({ id: _id, ...shop })),
    };
  });
  app.post("/logout", async (request, reply) => {
    const token = sessionToken(request);
    if (token)
      await (
        await connectDb()
      )
        .collection<Session>("authSessions")
        .deleteOne({ _id: digest(token) });
    return reply.header("Set-Cookie", cookie("", 0)).send({ ok: true });
  });
}
