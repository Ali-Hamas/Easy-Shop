"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { rememberedShop, rememberShop, draftKey } from "@/adapters/commerce";
import type { AuthSession } from "@/types/auth";
const SessionContext = createContext<AuthSession | null>(null);
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Authenticated session required.");
  return session;
}
export function clearShopSelection() {
  try {
    sessionStorage.removeItem(draftKey);
    sessionStorage.removeItem(`${draftKey}:name`);
  } catch {
    /* Browser storage is optional. */
  }
  window.dispatchEvent(new Event("easy-shop:changed"));
}
export function SessionProvider({
  session,
  children,
}: {
  session: AuthSession;
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const shop =
      session.shops.find((s) => s.id === rememberedShop()) ?? session.shops[0];
    if (shop) rememberShop(shop.id, shop.displayName);
    else clearShopSelection();
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [session]);
  return (
    <SessionContext.Provider value={session}>
      {ready ? (
        children
      ) : (
        <main className="page">
          <p role="status">Opening your workspace…</p>
        </main>
      )}
    </SessionContext.Provider>
  );
}
