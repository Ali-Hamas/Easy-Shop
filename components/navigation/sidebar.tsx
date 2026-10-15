"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Layers2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { releaseNavigation } from "@/config/navigation";
import { duration, ease } from "@/config/motion";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export function Sidebar({
  onNavigate,
  mobile = false,
  collapsed = false,
  onCollapse,
}: {
  onNavigate?: () => void;
  mobile?: boolean;
  collapsed?: boolean;
  onCollapse?: () => void;
}) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <div className={cn("sidebar-inner", mobile && "sidebar-mobile")}>
      <div className="brand-row">
        <Link
          href="/dashboard"
          className="brand"
          onClick={onNavigate}
          aria-label="Workspace home"
        >
          <span className="brand-mark">
            <Layers2 size={20} strokeWidth={1.7} />
          </span>
          <span className="sidebar-label">
            easy shop<span className="brand-period">.</span>
          </span>
        </Link>
        {onCollapse && (
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="sidebar-collapse"
            onClick={onCollapse}
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <PanelLeftClose size={16} />
            )}
          </IconButton>
        )}
      </div>
      <div className="workspace-label sidebar-label">
        <span className="tiny-dot" />
        Social commerce workspace
      </div>
      <nav aria-label="Main navigation">
        {[...new Set(releaseNavigation.map((item) => item.group))].map(
          (group) => (
            <div key={group} className="nav-group">
              <div className="nav-heading sidebar-label">{group}</div>
              {releaseNavigation
                .filter((n) => n.group === group)
                .map(({ slug, label, icon: Icon }) => {
                  const active = pathname === `/${slug}`;
                  return (
                    <Link
                      onClick={onNavigate}
                      title={label}
                      aria-label={label}
                      href={`/${slug}`}
                      key={slug}
                      aria-current={active ? "page" : undefined}
                      className={cn("nav-link", active && "nav-active")}
                    >
                      {active && (
                        <motion.span
                          className="nav-indicator"
                          layoutId={mobile ? "mobile-nav" : "main-nav"}
                          transition={{
                            duration: reduced ? 0 : duration.normal,
                            ease,
                          }}
                        />
                      )}
                      <Icon size={18} strokeWidth={active ? 1.9 : 1.65} />
                      <span className="sidebar-label">{label}</span>
                      {slug === "ai" && (
                        <span className="nav-ai sidebar-label" aria-hidden>
                          AI
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ),
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-footnote sidebar-label">
          <span className="tiny-dot" />
          Easy Shop workspace<span>v0.2</span>
        </div>
      </div>
    </div>
  );
}
