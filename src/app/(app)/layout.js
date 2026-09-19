"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ui";
import { SidebarProvider } from "@/components/SidebarContext";
import { api, saveSession, clearSession } from "@/lib/apiClient";

export default function AppLayout({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.get("/auth");
        if (!alive) return;
        saveSession({ user: data.user, mosque: data.mosque });
        setReady(true);
      } catch {
        clearSession();
        router.replace("/login");
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="login">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <ToastProvider>
        <div className="app">
          <Sidebar />
          <div className="main">{children}</div>
        </div>
      </ToastProvider>
    </SidebarProvider>
  );
}