import type { SVGProps } from "react";
import type { ThemeId } from "../core/types";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 20, props: P) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...props,
});

/** Original category icons. */
export function ThemeIcon({ theme, size = 22, ...props }: P & { theme: ThemeId }) {
  const p = base(size, props);
  switch (theme) {
    case "reality": // globe with a scanning eye
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" opacity=".5" />
          <path d="M7.5 12s1.8-2.6 4.5-2.6 4.5 2.6 4.5 2.6-1.8 2.6-4.5 2.6S7.5 12 7.5 12z" fill="currentColor" fillOpacity=".25" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        </svg>
      );
    case "signal": // broadcast mast with a cipher wave
      return (
        <svg {...p}>
          <path d="M12 13v8M9 21h6" />
          <circle cx="12" cy="11" r="1.6" fill="currentColor" />
          <path d="M8.2 7.2a5.4 5.4 0 0 0 0 7.6M15.8 7.2a5.4 5.4 0 0 1 0 7.6M5.4 4.4a9.4 9.4 0 0 0 0 13.2M18.6 4.4a9.4 9.4 0 0 1 0 13.2" />
        </svg>
      );
    case "machine": // chip with gear teeth
      return (
        <svg {...p}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" />
          <path d="M10 10.5l-1.5 1.5 1.5 1.5M14 10.5l1.5 1.5-1.5 1.5" />
        </svg>
      );
    case "archive": // stacked data discs
      return (
        <svg {...p}>
          <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
          <path d="M5 5.5v6.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5.5" />
          <path d="M5 12v6.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12" />
          <path d="M5 9c0 1.4 3.1 2.5 7 2.5S19 10.4 19 9" opacity=".5" />
        </svg>
      );
  }
}

export const Icon = {
  Lock: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  Unlock: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </svg>
  ),
  File: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  ),
  Check: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
  X: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  Bell: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  Sound: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  ),
  Mute: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  ),
  Up: (p: P) => (
    <svg {...base(p.size ?? 14, p)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  ),
  Down: (p: P) => (
    <svg {...base(p.size ?? 14, p)}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  ),
  Chevron: (p: P) => (
    <svg {...base(p.size ?? 16, p)}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  Menu: (p: P) => (
    <svg {...base(p.size ?? 22, p)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  ),
  Crown: (p: P) => (
    <svg {...base(p.size ?? 18, p)} fill="currentColor" stroke="none">
      <path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 10H5z" />
    </svg>
  ),
  Copy: (p: P) => (
    <svg {...base(p.size ?? 16, p)}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  ),
  Print: (p: P) => (
    <svg {...base(p.size ?? 16, p)}>
      <path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
      <rect x="7" y="14" width="10" height="7" />
    </svg>
  ),
  Plus: (p: P) => (
    <svg {...base(p.size ?? 16, p)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Trash: (p: P) => (
    <svg {...base(p.size ?? 16, p)}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  ),
  Grid: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  ),
  Send: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M4 12l16-8-6 16-2.5-6.5z" />
    </svg>
  ),
  Library: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M5 4h3v16H5zM10 4h3v16h-3zM15.5 4.5l2.9-.8 3.6 15.5-2.9.7z" />
    </svg>
  ),
  Users: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </svg>
  ),
  List: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  Gear: (p: P) => (
    <svg {...base(p.size ?? 18, p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </svg>
  ),
  Info: (p: P) => (
    <svg {...base(p.size ?? 16, p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </svg>
  ),
};
