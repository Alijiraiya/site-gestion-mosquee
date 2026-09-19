// Single source of truth for the light/dark theme.
//
// Two styling systems live in this app and both must stay in sync:
//   1. The dashboard design system (src/app/globals.css) is dark by default and
//      switches to light via <html data-theme="light">.
//   2. The landing page uses Tailwind's `dark:` variant, which is configured as
//      `&:is(.dark *)` in src/styles/theme.css -- so it needs a `.dark` class on
//      <html>.
//
// applyTheme() writes both, so the night-mode button behaves identically on the
// landing page and inside the app.

export const THEME_STORAGE_KEY = "theme";

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  } else {
    root.removeAttribute("data-theme");
    root.classList.add("dark");
  }
}

export function readTheme() {
  if (typeof window === "undefined") return "dark";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // localStorage can throw in private-browsing / blocked-cookie modes.
  }
  return "dark";
}

export function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore -- the theme still applies for the current page view.
  }
}

export function setTheme(theme) {
  applyTheme(theme);
  storeTheme(theme);
  if (typeof window !== "undefined") {
    // Lets every mounted toggle (landing header, app topbar) update together.
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }
  return theme;
}

// Inlined in <head> so the correct theme is painted before first paint.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t='dark';}var r=document.documentElement;if(t==='light'){r.setAttribute('data-theme','light');r.classList.remove('dark');}else{r.removeAttribute('data-theme');r.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;
