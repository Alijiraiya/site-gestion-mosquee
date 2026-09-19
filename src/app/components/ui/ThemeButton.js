"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { readTheme, setTheme } from "@/lib/theme";

// Night-mode toggle for the landing page top bar.
// Uses the same storage key and behaviour as the in-app Topbar toggle, so the
// choice carries over when the user signs in.
const ThemeButton = () => {
  const [theme, setThemeState] = useState("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setThemeState(readTheme());
    setMounted(true);

    // Keep this button in sync if the theme is changed elsewhere.
    const onChange = (e) => setThemeState(e.detail);
    window.addEventListener("themechange", onChange);
    return () => window.removeEventListener("themechange", onChange);
  }, []);

  const isLight = theme === "light";

  function toggle() {
    const next = isLight ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="landing-pill"
      title={isLight ? "Mode nuit" : "Mode clair"}
      aria-label={isLight ? "Activer le mode nuit" : "Activer le mode clair"}
    >
      {/* Render a stable icon until mounted to avoid a hydration mismatch. */}
      <Icon name={mounted && isLight ? "moon" : "sun"} size={16} />
    </button>
  );
};

export default ThemeButton;
