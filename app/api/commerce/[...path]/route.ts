import type { NextRequest } from "next/server";
const uuid = "[a-fA-F0-9-]{36}";
function permitted(path: string, method: string) {
  if (new RegExp(`^dashboard/${uuid}$`).test(path)) return method === "GET";
  if (/^storefront\/[a-z0-9-]+\/chat\/(session|messages)$/.test(path))
    return (
      method === "POST" || (method === "GET" && path.endsWith("/messages"))
    );
  if (
    /^auth\/(register|login|logout|me|forgot-password|forgot-password\/request|verify-otp|reset-password)$/.test(
      path,
    )
  )
    return path === "auth/me" ? method === "GET" : method === "POST";
  if (
    new RegExp(`^customers/${uuid}(?:/${uuid}(?:/(history|notes))?)?$`).test(
      path,
    )
  ) {
    return method === "GET"
      ? !path.endsWith("/notes")
      : method === "POST"
        ? new RegExp(`^customers/${uuid}$`).test(path) ||
          path.endsWith("/notes")
        : method === "PATCH" &&
          new RegExp(`^customers/${uuid}/${uuid}$`).test(path);
  }
  if (
    new RegExp(
      `^inventory/${uuid}/products(?:/${uuid}(?:/(history|adjustments))?)?$`,
    ).test(path)
  ) {
    return method === "GET"
      ? !path.endsWith("/adjustments")
      : method === "POST"
        ? path.endsWith("/products") || path.endsWith("/adjustments")
        : method === "PATCH" && new RegExp(`/products/${uuid}$`).test(path);
  }
  if (path.startsWith("inbox/")) {
    if (new RegExp(`^inbox/${uuid}/conversations$`).test(path)) {
      return method === "GET" || method === "POST";
    }
    if (new RegExp(`^inbox/${uuid}/conversations/${uuid}$`).test(path)) {
      return method === "GET";
    }
    if (
      new RegExp(`^inbox/${uuid}/conversations/${uuid}/messages$`).test(path)
    ) {
      return method === "GET" || method === "POST";
    }
    if (
      new RegExp(
        `^inbox/${uuid}/conversations/${uuid}/drafts(?:/generate)?$`,
      ).test(path)
    ) {
      return method === "GET" || method === "POST";
    }
    if (
      new RegExp(`^inbox/${uuid}/conversations/${uuid}/drafts/${uuid}$`).test(
        path,
      )
    ) {
      return method === "PATCH";
    }
    if (
      new RegExp(
        `^inbox/${uuid}/conversations/${uuid}/drafts/${uuid}/(review|approve|reject|send)$`,
      ).test(path)
    ) {
      return method === "POST";
    }
    return false;
  }
  return method === "GET"
    ? new RegExp(
        `^(onboarding/(templates|${uuid})|storefront/[a-z0-9-]+(?:/products/[a-z0-9-]+)?)$`,
      ).test(path)
    : method === "POST"
      ? new RegExp(
          `^onboarding/(start|subdomain/check|${uuid}/(products|channels/meta/skip|template|launch))$`,
        ).test(path)
      : method === "PATCH" &&
        new RegExp(`^onboarding/${uuid}/(shop|ai-mode)$`).test(path);
}
async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await context.params;
  const path = segments.join("/");
  const method = request.method;
  const fail = (status: number, code: string, message: string) =>
    Response.json(
      { code, message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!permitted(path, method))
    return fail(404, "NOT_FOUND", "This operation is not available.");
  const host = request.headers.get("host") ?? "";
  if (
    method !== "GET" &&
    request.headers.get("origin") !== `${request.nextUrl.protocol}//${host}`
  )
    return fail(
      403,
      "ORIGIN_REJECTED",
      "Open this form from the same local application.",
    );
  const bodyLimit = path.startsWith("inventory/") ? 256000 : 20000;
  if (Number(request.headers.get("content-length") ?? 0) > bodyLimit)
    return fail(413, "REQUEST_TOO_LARGE", "The submitted form is too large.");
  try {
    const upstream = new URL(
      process.env.BACKEND_API_URL ?? "http://127.0.0.1:4000",
    );
    if (
      !["http:", "https:"].includes(upstream.protocol) ||
      upstream.username ||
      upstream.password
    )
      throw Error("configuration");
    const body = method === "GET" ? undefined : await request.text();
    if (body && Buffer.byteLength(body, "utf8") > bodyLimit)
      return fail(413, "REQUEST_TOO_LARGE", "The submitted form is too large.");
    const destination = new URL(`/api/v1/${path}`, upstream);
    destination.search = request.nextUrl.search;
    const response = await fetch(destination, {
      method,
      body: body || undefined,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        Origin: process.env.APP_ORIGIN ?? "http://localhost:3000",
        Cookie: request.cookies
          .getAll()
          .filter(
            (c) =>
              c.name === "easy_shop_session" ||
              c.name.startsWith("easy_shop_buyer_"),
          )
          .map((c) => `${c.name}=${c.value}`)
          .join("; "),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) {
      const messages: Record<string, string> = {
        DRAFT_STALE:
          "This message or its product facts changed. Refresh, then generate and review a new draft.",
        AI_DISABLED:
          "AI is turned off for this shop. Change the supported AI option in shop setup.",
        CHANNEL_UNAVAILABLE:
          "This customer channel is not connected. Nothing was sent.",
        BUYER_SESSION_REQUIRED:
          "Your chat session has ended. Reopen the chat to continue.",
        INVALID_CREDENTIALS: "Email or password is incorrect.",
        ACCOUNT_EXISTS:
          "An account already uses this email. Log in with your existing credentials.",
        CUSTOMER_NOT_FOUND: "This customer could not be found in this shop.",
        CUSTOMER_CONFLICT:
          "This phone number belongs to an existing customer. Review that record; merging is not available yet.",
        VERSION_CONFLICT:
          "This record changed. Reload the latest data before saving.",
        SKU_CONFLICT:
          "This SKU or product address is already used. Review the existing product.",
        INVALID_STOCK:
          "This would make stock invalid. Check on-hand, reserved and sold quantities.",
        INVALID_QUANTITY: "Enter a positive quantity for this operation.",
        IDEMPOTENCY_CONFLICT:
          "This save reference was already used. Reload before trying again.",
        VARIANT_HISTORY_REQUIRED:
          "Existing variants must be retained to preserve their stock history.",
        AUTH_REQUIRED: "Your session has ended. Log in to continue.",
        FILTER_REQUIRED: "Narrow your filters to fewer than 2,000 products.",
        SHOP_NOT_FOUND:
          "This shop could not be found. Check the saved shop ID.",
        PRODUCT_NOT_FOUND: "This product is not available.",
        SUBDOMAIN_TAKEN: "That address is already in use. Choose another.",
        SUBDOMAIN_TOO_SHORT:
          "Use at least three letters or numbers for the address.",
        OWNER_CONFLICT: "Those owner details already belong to another record.",
        PRODUCT_CONFLICT:
          "This product already exists. Reload the shop before adding it again.",
        SHOP_LAUNCHED:
          "This shop is already launched. Draft editing is closed.",
        LAUNCH_BLOCKED: "Complete the launch checklist before publishing.",
        VALIDATION_ERROR: "Check the highlighted fields and try again.",
        TEMPLATE_NOT_FOUND: "This template is no longer available.",
        DATABASE_UNAVAILABLE:
          "The shop service is temporarily unavailable. Your input has been kept.",
        OTP_EXPIRED:
          "This verification code has expired (codes are valid for 10 minutes). Please request a new code.",
        OTP_INVALID:
          "Incorrect verification code. Please check and try again.",
        OTP_NOT_FOUND:
          "No verification code was requested for this email. Please request a code first.",
        RATE_LIMITED:
          "Please wait a moment before requesting another code.",
        TOO_MANY_ATTEMPTS:
          "Too many incorrect attempts. Please request a new code.",
        ACCOUNT_NOT_FOUND:
          "No account found with this email address.",
        RESET_TOKEN_INVALID:
          "Password reset session has expired or is invalid. Please request a new code.",
      };
      return Response.json(
        {
          code: typeof data.code === "string" ? data.code : "REQUEST_FAILED",
          message:
            messages[data.code] ??
            (typeof data.message === "string"
              ? data.message
              : "The shop service could not complete this request."),
          issues:
            data.code === "VALIDATION_ERROR" && Array.isArray(data.issues)
              ? data.issues.map((i: { path: unknown; message: unknown }) => ({
                  path: i.path,
                  message:
                    typeof i.message === "string"
                      ? i.message
                      : "Check this field.",
                }))
              : [],
        },
        { status: response.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(data, {
      status: response.status,
      headers: {
        "Cache-Control": "no-store",
        ...(response.headers.get("set-cookie")
          ? { "Set-Cookie": response.headers.get("set-cookie")! }
          : {}),
      },
    });
  } catch {
    return fail(
      503,
      "BACKEND_UNAVAILABLE",
      "The shop service cannot be reached. Your input is still here. A save may have completed; reload the saved shop before retrying.",
    );
  }
}
export const GET = forward;
export const POST = forward;
export const PATCH = forward;
