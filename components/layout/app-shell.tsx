"use client";
import { useState, useCallback } from "react";
import { MotionConfig } from "framer-motion";
import { Sidebar } from "@/components/navigation/sidebar";
import { Topbar } from "./topbar";
import { Drawer } from "@/components/ui/overlays";
import { ToastProvider } from "@/components/ui/toast";
import { CommandDialog } from "@/components/ai/command-dialog";
import { useCommandShortcut } from "@/hooks/use-command-shortcut";
export function AppShell({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [command, setCommand] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const openCommand = useCallback(() => setCommand(true), []);
  useCommandShortcut(openCommand);
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <div className="app-shell" data-collapsed={collapsed}>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <aside className="sidebar">
            <Sidebar
              collapsed={collapsed}
              onCollapse={() => setCollapsed((v) => !v)}
            />
          </aside>
          <div className="app-body">
            <Topbar onMenu={() => setMenu(true)} onCommand={openCommand} />
            <main id="main-content" tabIndex={-1}>
              {children}
            </main>
            <footer className="app-footer">
              <span>One workspace. Every part of your shop.</span>
              <span>
                <span className="tiny-dot" />
                Your shop workspace
              </span>
            </footer>
          </div>
          <Drawer
            variant="navigation"
            open={menu}
            onOpenChange={setMenu}
            title="Your workspace"
            description="Navigate your shop"
          >
            <Sidebar mobile onNavigate={() => setMenu(false)} />
          </Drawer>
          <CommandDialog open={command} onOpenChange={setCommand} />
        </div>
      </ToastProvider>
    </MotionConfig>
  );
}
