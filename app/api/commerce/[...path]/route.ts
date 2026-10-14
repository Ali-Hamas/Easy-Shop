import type { NextRequest } from "next/server";

const uuid = "[a-fA-F0-9-]{36}";
const dashboardPath = new RegExp(`^dashboard/${uuid}$`);
const orderPath = new RegExp(`^orders/${uuid}$`);
const storefrontOrdersPath = /^orders\/storefront\/[A-Za-z0-9-]+\/orders$/;
const storefrontChatPath = /^storefront\/[A-Za-z0-9-]+\/chat\/(session|messages)$/;
const authPath = /^auth\/(register|login|logout|me|forgot-password|forgot-password\/request|verify-otp|reset-password)$/;
const customerPath = new RegExp(`^customers/${uuid}(?:/${uuid}(?:/(history|notes))?)?$`);
const customerRootPath = new RegExp(`^customers/${uuid}$`);
const customerPatchPath = new RegExp(`^customers/${uuid}/${uuid}$`);
const inventoryPath = new RegExp(
  `^inventory/${uuid}/products(?:/${uuid}(?:/(history|adjustments))?)?$`,
);
const inventoryPatchPath = new RegExp(`/products/${uuid}$`);
const adsOverviewPath = new RegExp(`^ads/${uuid}$`);
const adsConnectPath = new RegExp(`^ads/${uuid}/connect$`);
const adsSelectionPath = new RegExp(`^ads/${uuid}/selection$`);
const adsSyncPath = new RegExp(`^ads/${uuid}/insights/sync$`);
const inboxSettingsPath = new RegExp(`^inbox/${uuid}/ai-settings$`);
const inboxChannelsPath = new RegExp(`^inbox/${uuid}/channels$`);
const inboxConnectPath = new RegExp(`^inbox/${uuid}/channels/meta/connect$`);
const inboxConversationsPath = new RegExp(`^inbox/${uuid}/conversations$`);
const inboxConversationPath = new RegExp(`^inbox/${uuid}/conversations/${uuid}$`);
const inboxMessagesPath = new RegExp(`^inbox/${uuid}/conversations/${uuid}/messages$`);
const inboxDraftsPath = new RegExp(
  `^inbox/${uuid}/conversations/${uuid}/drafts(?:/generate)?$`,
);
const inboxDraftPath = new RegExp(`^inbox/${uuid}/conversations/${uuid}/drafts/${uuid}$`);
const inboxDraftActionPath = new RegExp(
  `^inbox/${uuid}/conversations/${uuid}/drafts/${uuid}/(review|approve|reject|send)$`,
);
const publicGetPath = new RegExp(
  `^(onboarding/(templates|${uuid})|storefront/[A-Za-z0-9-]+(?:/products/[A-Za-z0-9-]+)?)$`,
);
const publicPostPath = new RegExp(
  `^onboarding/(start|subdomain/check|${uuid}/(products|channels/meta/skip|template|launch))$`,
);
const publicPatchPath = new RegExp(`^onboarding/${uuid}/(shop|ai-mode)$`);

function permitted(path: string, method: string) {
  if (dashboardPath.test(path)) return method === "GET";
  if (orderPath.test(path)) return method === "GET";
  if (storefrontOrdersPath.test(path))
    return method === "POST";
  if (storefrontChatPath.test(path))
    return (
      method === "POST" || (method === "GET" && path.endsWith("/messages"))
    );
  if (authPath.test(path))
    return path === "auth/me" ? method === "GET" : method === "POST";
  if (customerPath.test(path)) {
    return method === "GET"
      ? !path.endsWith("/notes")
      : method === "POST"
        ? customerRootPath.test(path) || path.endsWith("/notes")
        : method === "PATCH" &&
          customerPatchPath.test(path);
  }
  if (inventoryPath.test(path)) {
    return method === "GET"
      ? !path.endsWith("/adjustments")
      : method === "POST"
        ? path.endsWith("/products") || path.endsWith("/adjustments")
        : method === "PATCH" && inventoryPatchPath.test(path);
  }
  if (adsOverviewPath.test(path)) return method === "GET";
  if (adsConnectPath.test(path) || adsSyncPath.test(path))
    return method === "POST";
  if (adsSelectionPath.test(path)) return method === "PATCH";
  if (path.startsWith("inbox/")) {
    if (inboxSettingsPath.test(path)) {
      return method === "GET" || method === "PATCH";
    }
    if (inboxChannelsPath.test(path)) {
      return method === "GET";
    }
    if (inboxConnectPath.test(path)) {
      return method === "POST";
    }
    if (path === "inbox/channels/meta/callback") {
      return method === "GET";
    }
    if (inboxConversationsPath.test(path)) {
      return method === "GET" || method === "POST";
    }
    if (inboxConversationPath.test(path)) {
      return method === "GET";
    }
    if (inboxMessagesPath.test(path)) {
      return method === "GET" || method === "POST";
    }
    if (inboxDraftsPath.test(path)) {
      return method === "GET" || method === "POST";
    }
    if (inboxDraftPath.test(path)) {
      return method === "PATCH";
    }
    if (inboxDraftActionPath.test(path)) {
      return method === "POST";
    }
    return false;
  }
  return method === "GET"
    ? publicGetPath.test(path)
    : method === "POST"
      ? publicPostPath.test(path)
      : method === "PATCH" &&
        publicPatchPath.test(path);
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
  const bodyLimit = path.startsWith("inventory/") ? 15 * 1024 * 1024 : 20000;
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
        META_NOT_CONFIGURED:
          "Meta app credentials are not configured yet.",
        META_NO_PAGES:
          "Meta did not grant access to a Facebook Page. Try connecting again and choose a Page.",
        META_REQUEST_FAILED:
          "Meta could not complete the connection request.",
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
        INSUFFICIENT_STOCK:
          "One product does not have enough stock. Adjust your bag and try again.",
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
        CURRENCY_LOCKED:
          "Currency cannot be changed after products exist.",
        TEMPLATE_NOT_LAUNCHABLE:
          "Choose a production-ready template or add a real product before launch.",
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
          ...(typeof data.retryAfter === "number"
            ? { retryAfter: data.retryAfter }
            : {}),
          ...(typeof data.remainingAttempts === "number"
            ? { remainingAttempts: data.remainingAttempts }
            : {}),
        },
        { status: response.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    const getSetCookie = (
      response.headers as Headers & { getSetCookie?: () => string[] }
    ).getSetCookie;
    const setCookies = getSetCookie
      ? getSetCookie.call(response.headers)
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")!]
        : [];
    const headers = new Headers({ "Cache-Control": "no-store" });
    for (const cookie of setCookies) headers.append("Set-Cookie", cookie);
    return Response.json(data, {
      status: response.status,
      headers,
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
