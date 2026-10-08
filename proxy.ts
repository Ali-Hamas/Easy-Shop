import { NextRequest, NextResponse } from "next/server";

const label = /^[a-z0-9-]{3,40}$/;
const ignored = new Set(["www"]);

function storefrontRoot() {
  const configured = process.env.STOREFRONT_ROOT_DOMAIN;
  if (configured) return configured.toLowerCase();
  const origin = process.env.APP_ORIGIN;
  return origin ? new URL(origin).hostname.toLowerCase() : "";
}

export function proxy(request: NextRequest) {
  const root = storefrontRoot();
  const host = (request.headers.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  if (!root || !host.endsWith(`.${root}`)) return NextResponse.next();

  const subdomain = host.slice(0, -root.length - 1);
  if (!label.test(subdomain) || ignored.has(subdomain)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname =
    url.pathname === "/"
      ? `/store/${subdomain}`
      : `/store/${subdomain}${url.pathname}`;
  url.protocol = "http:";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
