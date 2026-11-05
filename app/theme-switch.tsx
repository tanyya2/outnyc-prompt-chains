"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

// The viewer's choice, kept in this browser. "system" follows the device's setting.
type Choice = "system" | "light" | "dark";
const KEY = "theme";
const CHANGED = "theme-change";

const dark = () => window.matchMedia("(prefers-color-scheme: dark)");

function readChoice(): Choice {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

// Same logic as the script in layout.tsx, which runs before the first paint
function apply(choice: Choice) {
  const isDark = choice === "dark" || (choice === "system" && dark().matches);
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

// System / Light / Dark as three icons in the header
export function ThemeSwitch() {
  // The server doesn't know the choice, so it renders "system"; the browser then shows the saved one
  const choice = useSyncExternalStore(subscribe, readChoice, () => "system" as Choice);

  // Re-apply after React's dev remount clears <html> attributes, and follow the
  // device when it switches between light and dark (only matters for "system")
  useLayoutEffect(() => {
    apply(choice);
    if (choice !== "system") return;
    const media = dark();
    const follow = () => apply("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [choice]);

  function change(next: Choice) {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the theme still changes for this visit
    }
    apply(next);
    window.dispatchEvent(new Event(CHANGED));
  }

  return (
    <div role="group" aria-label="Theme" className="flex rounded-full border border-line-strong p-0.5">
      {OPTIONS.map(({ value, label, icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => change(value)}
          aria-pressed={choice === value}
          aria-label={label}
          title={label}
          className={`flex size-6 items-center justify-center rounded-full ${
            choice === value ? "bg-ink text-paper" : "text-muted hover:text-ink"
          }`}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {icon}
          </svg>
        </button>
      ))}
    </div>
  );
}

// Screen = follow the device, sun = light, moon = dark
const OPTIONS: { value: Choice; label: string; icon: React.ReactNode }[] = [
  {
    value: "system",
    label: "System theme",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
  },
  {
    value: "light",
    label: "Light theme",
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: "dark",
    label: "Dark theme",
    icon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  },
];
