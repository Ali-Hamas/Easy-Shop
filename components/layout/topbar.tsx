"use client";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  rememberShop,
  rememberedShopName,
  subscribeShop,
} from "@/adapters/commerce";
import {
  Bell,
  CircleHelp,
  ChevronDown,
  Menu,
  Store,
  Unplug,
} from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { Dropdown, Popover } from "@/components/ui/overlays";
import { AIAccent } from "@/components/ai/ai-primitives";
import {
  useSession,
  clearShopSelection,
} from "@/components/auth/session-provider";
import { logout } from "@/services/auth";
export function Topbar({
  onMenu,
  onCommand,
}: {
  onMenu: () => void;
  onCommand: () => void;
}) {
  const router = useRouter();
  const session = useSession();
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  async function signOut() {
    setLoggingOut(true);
    setLogoutError("");
    const result = await logout();
    if (result.ok) {
      clearShopSelection();
      router.replace("/login");
      router.refresh();
    } else {
      setLogoutError(result.message);
      setLoggingOut(false);
    }
  }
  const shopName = useSyncExternalStore(
    subscribeShop,
    rememberedShopName,
    () => null,
  );
  return (
    <header className="topbar">
      <div className="topbar-workspace">
        <IconButton
          label="Open navigation"
          className="mobile-menu"
          onClick={onMenu}
        >
          <Menu size={19} />
        </IconButton>
        <Dropdown
          trigger={
            <button className="shop-switcher">
              <span className="shop-icon">
                <Store size={17} />
              </span>
              <span>
                {shopName ?? "Your workspace"}
                <span className="shop-subtitle">
                  {shopName ? "Your shop" : "No shop selected"}
                </span>
              </span>
              <ChevronDown size={13} />
            </button>
          }
          items={[
            ...session.shops.map((shop) => ({
              label: shop.displayName,
              onSelect: () => {
                rememberShop(shop.id, shop.displayName);
                router.refresh();
              },
            })),
            {
              label: "Open shop setup",
              onSelect: () => router.push("/onboarding"),
            },
            {
              label: "Shop settings",
              onSelect: () => router.push("/settings"),
            },
          ]}
        />
      </div>
      <Button
        variant="secondary"
        className="command-trigger"
        aria-label="Ask AI to do work"
        onClick={onCommand}
      >
        <AIAccent size="sm" />
        <span>Ask AI or find anything…</span>
        <kbd>Ctrl K</kbd>
      </Button>
      <div className="topbar-actions">
        <Popover
          label="Connection health"
          trigger={
            <button
              className="connection"
              aria-label="Connection health: not connected"
            >
              <span className="connection-dot" />
              <span>Not connected</span>
              <ChevronDown size={12} />
            </button>
          }
        >
          <div className="popover-heading">
            <Unplug size={18} />
            <h3>No channels connected</h3>
          </div>
          <p>
            Messenger and Instagram are not connected. Your saved storefront
            status is shown on the dashboard.
          </p>
        </Popover>
        <div className="utility-controls">
          <Popover
            label="Notifications"
            trigger={
              <IconButton label="Notifications">
                <Bell size={18} />
              </IconButton>
            }
          >
            <h3>You’re all caught up</h3>
            <p>No notifications are available yet.</p>
          </Popover>
          <Popover
            label="Help"
            trigger={
              <IconButton label="Help">
                <CircleHelp size={18} />
              </IconButton>
            }
          >
            <h3>A connected way to work</h3>
            <p>
              A unified social commerce workspace for managing products, orders,
              conversations, and customer relationships.
            </p>
          </Popover>
        </div>
        <Dropdown
          trigger={
            <button className="profile-button" aria-label="User profile">
              <Avatar name={session.user.name} />
            </button>
          }
          items={[
            {
              label: session.user.name,
              disabled: true,
              onSelect: () => {},
            },
            {
              label: "Settings",
              onSelect: () => router.push("/settings"),
            },
            {
              label: loggingOut ? "Logging out…" : "Log out",
              disabled: loggingOut,
              onSelect: () => void signOut(),
            },
          ]}
        />
      </div>
      {logoutError && <p role="alert">{logoutError}</p>}
    </header>
  );
}
