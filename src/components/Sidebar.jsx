"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "./icons";
import { api, clearSession, readUser } from "@/lib/apiClient";
import { initials } from "@/lib/format";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSidebar } from "./SidebarContext";
import { imgMosqueLogo } from "@/lib/utils";

// Only the screens present in the design mockups are implemented. The remaining
// items are shown to stay faithful to the sidebar design but are not wired up.
const NAV = [
  {
    href: "/dashboard",
    label: "Tableau de bord",
    icon: "dashboard",
    ready: true,
  },
  { href: "/familles", label: "Familles", icon: "families", ready: true },
  {
    href: "/dons",
    label: "Dons",
    icon: "gift",
    ready: true,
  },
  {
    href: "/donateurs",
    label: "Donateurs",
    icon: "donors",
    ready: true,
  },
  {
    href: "/distributions",
    label: "Distributions",
    icon: "distributions",
    ready: true,
  },
  {
    href: "/settings",
    label: "Param\u00e8tres",
    icon: "settings",
    ready: true,
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("App");
  const [user, setUser] = useState(null);
  const { collapsed } = useSidebar();

  useEffect(() => setUser(readUser()), []);

  const name = user ? `${user.firstName} ${user.lastName}` : t("Utilisateur");

  async function logout() {
    try {
      await api.post("/auth/logout", {});
    } catch {}
    clearSession();
    router.replace("/login");
  }

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <Link href="/dashboard" className="brand" title="ZAKAT">
        <img src={imgMosqueLogo} alt="ZAKAT" className="brand-logo" />
        <div className="brand-text">
          <div className="brand-name">ZAKAT</div>
          <div className="brand-tagline">{t("brandTagline")}</div>
        </div>
      </Link>
      <div className="brand-sub">{t("MENU")}</div>
      <nav className="nav">
        {NAV.map((n) => {
          const active =
            pathname === n.href || pathname.startsWith(n.href + "/");
          if (!n.ready) {
            return (
              <span
                key={n.href}
                className="nav-item disabled"
                title={t("Interface non incluse")}
              >
                <Icon name={n.icon} size={18} className="ico" />
                <span>{t(n.label)}</span>
              </span>
            );
          }
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <Icon name={n.icon} size={18} className="ico" />
              <span>{t(n.label)}</span>
            </Link>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <div className="avatar sm">{initials(name)}</div>
        <div className="who">
          <b>{name}</b>
          <span>
            {user?.role === "ADMIN" ? t("Administrateur") : t("Imam")}
          </span>
        </div>
        <button
          className="modal-close sidebar-logout"
          onClick={logout}
          title={t("D\u00e9connexion")}
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
  );
}