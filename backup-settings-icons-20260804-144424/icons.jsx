// Minimal inline SVG icon set (stroke-based, inherits currentColor).
export function Icon({ name, size = 18, ...rest }) {
  const paths = ICONS[name] || ICONS.dot;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {paths}
    </svg>
  );
}

const ICONS = {
  dot: <circle cx="12" cy="12" r="3" />,
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  families: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M15 11a3 3 0 1 0-2-5.2" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M17 15c2.5.4 4 2.2 4 5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="5" rx="1" />
      <path d="M4 13v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 8v13" />
      <path d="M12 8S10.5 3 8 4.5 9.5 8 12 8Zm0 0s1.5-5 4-3.5S14.5 8 12 8Z" />
    </>
  ),
  donors: (
    <>
      <path d="M20.8 5.6a5 5 0 0 0-7.1 0l-1.7 1.7-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" />
    </>
  ),
  distributions: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M8 15h4" />
    </>
  ),
  // Clean, symmetric 8-lobe gear. The previous path mixed a half-height
  // outline with a full-height circle, which rendered as a broken blob at
  // small sizes in the sidebar and the profile menu.
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M10.6 2.8h2.8l.35 2.1a7.2 7.2 0 0 1 1.66.96l1.98-.8 1.4 2.42-1.63 1.36a7.3 7.3 0 0 1 0 1.92l1.63 1.36-1.4 2.42-1.98-.8a7.2 7.2 0 0 1-1.66.96l-.35 2.1h-2.8l-.35-2.1a7.2 7.2 0 0 1-1.66-.96l-1.98.8-1.4-2.42 1.63-1.36a7.3 7.3 0 0 1 0-1.92L4.82 7.48l1.4-2.42 1.98.8a7.2 7.2 0 0 1 1.66-.96Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  heart: (
    <path d="M20.8 5.6a5 5 0 0 0-7.1 0l-1.7 1.7-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" />
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18M16 14h2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <path d="M16 5.2A3 3 0 0 1 18 11M17 15c2.5.4 4 2.2 4 5" />
    </>
  ),
  globe: (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a15 15 0 0 1 0 18" />
    <path d="M12 3a15 15 0 0 0 0 18" />
  </>
),

chevronDown: (
  <path d="m6 9 6 6 6-6" />
),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),

  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  sidebarToggle: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </>
  ),
/* Add these two entries into the ICONS object in src/components/icons.jsx */

  trendUp: (
    <>
      <path d="M4 15 10 9l4 4 6-7" />
      <path d="M20 6h-4M20 6v4" />
    </>
  ),
  trendDown: (
    <>
      <path d="M4 9l6 6 4-4 6 7" />
      <path d="M20 18v-4M20 18h-4" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  play: (
    <path d="M6 4.5v15l13-7.5-13-7.5Z" />
  ),
  eye: (
    <>
      <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  spread: (
    <>
      <path d="M12 19v-6" />
      <path d="M12 13 6 7" />
      <path d="M6 7h4M6 7v4" />
      <path d="M12 13l6-6" />
      <path d="M18 7h-4M18 7v4" />
    </>
  ),

  eye: (
    <>
      <path d="M1 12s4-7.5 11-7.5S23 12 23 12s-4 7.5-11 7.5S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),

  save: (
    <>
      <path d="M5 3h11l3 3v15H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M8 3v5h8V3" />
      <path d="M7 21v-7h10v7" />
    </>
  ),
 building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 21v-4h6v4M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h13M21 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  shield: (
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 4v5h-5" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.4h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.2" />
      <path d="M12 17h.01" />
    </>
  ),
};