"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Icon } from "./icons";
import { useSidebar } from "./SidebarContext";
import { api, clearSession, readUser } from "@/lib/apiClient";
import { initials as computeInitials } from "@/lib/format";
import { readTheme, setTheme } from "@/lib/theme";

function setLocaleCookie(next) {
  document.cookie = `locale=${next}; path=/; max-age=31536000`;
}

export default function Topbar({
  title,
  subtitle,
  actions,
  breadcrumb,
}) {
  const router = useRouter();
  const { toggle: toggleSidebar } = useSidebar();
  const t = useTranslations("Topbar");
  // "App" holds the shared FR->AR catalogue (src/lib/i18n.js) used by the
  // dashboard pages. The topbar had several hard-coded French strings that
  // stayed French when switching to Arabic.
  const tApp = useTranslations("App");
  const locale = useLocale();

  const [isLight, setIsLight] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authUser, setAuthUser] = useState(null);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    // applyTheme also drives the landing page's Tailwind `.dark` class, so the
    // theme stays consistent between the marketing site and the dashboard.
    const saved = readTheme();
    setIsLight(saved === "light");
    setTheme(saved);

    const onChange = (e) => setIsLight(e.detail === "light");
    window.addEventListener("themechange", onChange);
    return () => window.removeEventListener("themechange", onChange);
  }, []);

  // Pull the real logged-in user (set at login via saveSession) instead of
  // showing a static placeholder.
  useEffect(() => {
    setAuthUser(readUser());
  }, []);

  const name = authUser ? `${authUser.firstName} ${authUser.lastName}` : "Brahim D.";
  const role =
    authUser?.role === "IMAM" ? tApp("Imam") : tApp("Administrateur");
  const user = {
    name,
    role,
    initials: authUser ? computeInitials(name) : "BD",
  };

  function toggleTheme() {
    const next = isLight ? "dark" : "light";
    setIsLight(next === "light");
    setTheme(next);
  }

  function toggleLanguage() {
    const next = locale === "fr" ? "ar" : "fr";
    setLocaleCookie(next);
    router.refresh();
  }

  // The three items of the profile dropdown used to be decorative: no onClick
  // at all, so nothing happened when they were clicked.

  // Profil -> Settings / Utilisateur, Param\u00e8tres -> Settings / Param\u00e8tres.
  function openSettingsTab(key) {
    setShowProfile(false);
    router.push(`/settings?tab=${key}`);
    // A query-only navigation does not remount the settings page, so when the
    // menu is used while already on /settings the page is told directly.
    window.dispatchEvent(new CustomEvent("settings-tab", { detail: key }));
  }

  // Same sign-out path as the sidebar: clear the httpOnly cookie server-side,
  // then the local session, then leave the protected area.
  async function logout() {
    setShowProfile(false);
    try {
      await api.post("/auth/logout", {});
    } catch {}
    clearSession();
    router.replace("/login");
  }

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className={`topbar-crumb-wrap ${scrolled ? "scrolled" : ""}`}>
        <div className="topbar-crumb">
          <button className="crumb-btn" onClick={toggleSidebar} title={t("toggleSidebar")}>
            <Icon name="sidebarToggle" size={16} />
          </button>
          <button className="crumb-btn" onClick={() => router.push("/dashboard")} title={tApp("Accueil")}>
            <Icon name="home" size={16} />
          </button>
          <Icon name="chevronRight" size={14} className="crumb-sep" />
          <span className="crumb-text">{breadcrumb || title}</span>

          <div className="topbar-spacer" />

          {/* LANGUAGE — now actually switches the locale */}
          <button onClick={toggleLanguage} className="icon-pill icon-pill-wide" title="FR / AR">
            <Icon name="globe" size={15} />
            <span>{locale.toUpperCase()}</span>
          </button>

          {/* THEME */}
          <button onClick={toggleTheme} className="icon-pill" title={t("toggleTheme")}>
            <Icon name={isLight ? "moon" : "sun"} size={16} />
          </button>

          {/* NOTIFICATIONS */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNotif(!showNotif);
              }}
              className="icon-pill"
              title={t("notifications")}
            >
              <Icon name="bell" size={16} />
              <span className="dot" />
            </button>

            {showNotif && (
              <div className="panel dropdown-panel">
                <div className="dropdown-head">{t("notifications")}</div>
                <div className="state" style={{ padding: "28px 18px" }}>
                  {tApp("Aucune notification")}
                </div>
              </div>
            )}
          </div>

          {/* PROFILE */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowProfile(!showProfile);
              }}
              className="icon-pill avatar-trigger"
            >
              <span className="avatar-pill">{user.initials}</span>
              <Icon name="chevronDown" size={14} />
            </button>

            {showProfile && (
              <div className="panel dropdown-panel" style={{ width: 220 }}>
                <div className="dropdown-head">
                  <div style={{ fontWeight: 700 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{user.role}</div>
                </div>
                <button
                  className="dropdown-item"
                  onClick={() => openSettingsTab("user")}
                >
                  <Icon name="user" size={17} /> {tApp("Profil")}
                </button>
                <button
                  className="dropdown-item"
                  onClick={() => openSettingsTab("settings")}
                >
                  <Icon name="settings" size={17} /> {t("settings")}
                </button>
                <div className="dropdown-sep" />
                <button className="dropdown-item danger" onClick={logout}>
                  <Icon name="logout" size={17} /> {t("logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="topbar-title-row">
        <div className="page-title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions && <div className="topbar-actions">{actions}</div>}
      </div>
    </>
  );
}